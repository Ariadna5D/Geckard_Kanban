import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Crea una Checkout Session de Stripe y devuelve la URL de pago.
   */
  async createCheckoutSession(
    userId: string,
    plan: 'pro' | 'team',
  ): Promise<{ url: string }> {
    const stripeKey = this.getRequiredStringConfig(
      'STRIPE_SECRET_KEY',
      'Stripe no está configurado (STRIPE_SECRET_KEY).',
    );

    const successUrl = this.getRequiredStringConfig(
      'STRIPE_SUCCESS_URL',
      'Falta STRIPE_SUCCESS_URL en el entorno.',
    );
    const cancelUrl = this.getRequiredStringConfig(
      'STRIPE_CANCEL_URL',
      'Falta STRIPE_CANCEL_URL en el entorno.',
    );

    const pricePro = this.configService.get<string>('STRIPE_PRICE_PRO');
    const priceTeam = this.configService.get<string>('STRIPE_PRICE_TEAM');
    const priceId = plan === 'pro' ? pricePro : priceTeam;
    if (priceId === undefined || priceId === null || priceId.trim() === '') {
      throw new InternalServerErrorException(
        'Falta STRIPE_PRICE_PRO o STRIPE_PRICE_TEAM en el entorno.',
      );
    }

    // Validación de usuario y plan actual
    const user = await this.usersService.findById(userId);
    if (user === null) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.userPlan === 'team') {
      throw new BadRequestException('Ya tienes el plan team.');
    }
    if (user.userPlan === 'pro' && plan === 'pro') {
      throw new BadRequestException('Ya tienes el plan pro.');
    }

    // Creación de sesión de pago en Stripe
    const stripe = new Stripe(stripeKey);
    // Si el usuario ya tiene un stripeCustomerId,asociamos la sesión a ese cliente para evitar crear clientes duplicados
    const customerId =
      user.stripeCustomerId !== null &&
      user.stripeCustomerId !== undefined &&
      user.stripeCustomerId.trim() !== ''
        ? user.stripeCustomerId
        : undefined;

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: userId,
        metadata: {
          appUserId: userId,
          targetPlan: plan,
        },
        ...(customerId !== undefined
          ? { customer: customerId }
          : { customer_email: user.email }),
      });

      if (session.url === null || session.url === undefined) {
        throw new InternalServerErrorException(
          'Stripe no devolvió URL de checkout.',
        );
      }

      return { url: session.url };
    } catch (err: unknown) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Error desconocido';
      throw new BadRequestException(
        'No se pudo crear la sesión de pago: ' + message,
      );
    }
  }

  /**
   * Abre el Customer Portal de Stripe (cancelar plan, método de pago, facturas).
   */
  async createCustomerPortalSession(userId: string): Promise<{ url: string }> {
    const stripeKey = this.getRequiredStringConfig(
      'STRIPE_SECRET_KEY',
      'Stripe no está configurado (STRIPE_SECRET_KEY).',
    );
    const returnUrl = this.getRequiredStringConfig(
      'STRIPE_PORTAL_RETURN_URL',
      'Falta STRIPE_PORTAL_RETURN_URL en el entorno (URL del perfil tras el portal).',
    );

    const user = await this.usersService.findById(userId);
    if (user === null) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const customerId =
      user.stripeCustomerId !== null &&
      user.stripeCustomerId !== undefined &&
      user.stripeCustomerId.trim() !== ''
        ? user.stripeCustomerId
        : null;
    if (customerId === null) {
      throw new BadRequestException(
        'No hay cliente de Stripe asociado. Contrata un plan primero.',
      );
    }

    const stripe = new Stripe(stripeKey);
    try {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      if (portalSession.url === null || portalSession.url === undefined) {
        throw new InternalServerErrorException(
          'Stripe no devolvió URL del portal.',
        );
      }
      return { url: portalSession.url };
    } catch (err: unknown) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Error desconocido';
      throw new BadRequestException(
        'No se pudo abrir el portal de facturación: ' + message,
      );
    }
  }

  /**
   * Valida y procesa eventos de Stripe recibidos por webhook.
   */
  async handleStripeWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: true }> {
    const stripeKey = this.getRequiredStringConfig(
      'STRIPE_SECRET_KEY',
      'Stripe no está configurado (STRIPE_SECRET_KEY).',
    );
    const webhookSecret = this.getRequiredStringConfig(
      'STRIPE_WEBHOOK_SECRET',
      'Falta STRIPE_WEBHOOK_SECRET en el entorno.',
    );
    const stripe = new Stripe(stripeKey);

    let event: { type: string; data: { object: unknown } };
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Firma webhook de Stripe inválida.');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        metadata?: Record<string, string>;
        client_reference_id?: string | null;
        customer?: unknown;
        subscription?: unknown;
      };
      const appUserId = session.metadata?.appUserId ?? session.client_reference_id ?? '';
      const targetPlan = session.metadata?.targetPlan ?? '';

      if (appUserId.trim() === '') {
        throw new BadRequestException(
          'Webhook Stripe sin appUserId/client_reference_id.',
        );
      }
      if (targetPlan !== 'pro' && targetPlan !== 'team') {
        throw new BadRequestException(
          'Webhook Stripe con targetPlan no válido.',
        );
      }

      const customerId = this.getStripeObjectId(session.customer);
      const subscriptionId = this.getStripeObjectId(session.subscription);

      await this.usersService.updatePlanFromStripe(
        appUserId,
        targetPlan,
        customerId,
        subscriptionId,
      );
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as {
        customer?: unknown;
        id?: string;
      };
      const customerId = this.getStripeObjectId(subscription.customer);
      const subscriptionId =
        typeof subscription.id === 'string' && subscription.id.trim() !== ''
          ? subscription.id
          : null;
      if (customerId !== null && customerId.trim() !== '') {
        await this.usersService.downgradeToFreeAfterStripeSubscriptionEnd(
          customerId,
          subscriptionId,
        );
      }
    }

    return { received: true };
  }

  private getRequiredStringConfig(key: string, errorMessage: string): string {
    const value = this.configService.get<string>(key);
    if (value === undefined || value === null || value.trim() === '') {
      throw new InternalServerErrorException(errorMessage);
    }
    return value;
  }

  private getStripeObjectId(
    value: unknown,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object' && 'id' in value) {
      const objectWithId = value as { id?: unknown };
      if (
        typeof objectWithId.id === 'string' &&
        objectWithId.id.trim() !== ''
      ) {
        return objectWithId.id;
      }
    }
    return null;
  }
}
