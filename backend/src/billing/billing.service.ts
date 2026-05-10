import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';

@Injectable()
export class BillingService {
  /**
   * Inyecta config y servicio de usuarios para facturacion
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Crea sesion de checkout en stripe para plan pro o team
   */
  async createCheckoutSession(
    userId: string,
    plan: 'pro' | 'team',
  ): Promise<{ url: string }> {
    const stripeKey = this.getRequiredStringConfig(
      'STRIPE_SECRET_KEY',
      'Stripe no configurado.',
    );

    const successUrl = this.getRequiredStringConfig(
      'STRIPE_SUCCESS_URL',
      'Falta STRIPE_SUCCESS_URL.',
    );
    const cancelUrl = this.getRequiredStringConfig(
      'STRIPE_CANCEL_URL',
      'Falta STRIPE_CANCEL_URL.',
    );

    const pricePro = this.configService.get<string>('STRIPE_PRICE_PRO');
    const priceTeam = this.configService.get<string>('STRIPE_PRICE_TEAM');
    let priceId = priceTeam;
    if (plan === 'pro') {
      priceId = pricePro;
    }
    // Valida que exista el precio del plan elegido antes de ir a stripe
    if (priceId === undefined || priceId === null || priceId.trim() === '') {
      throw new InternalServerErrorException('Falta precio de Stripe.');
    }

    const user = await this.usersService.findById(userId);
    if (user === null) {
      throw new NotFoundException('Usuario no existe.');
    }

    if (user.userPlan === 'team') {
      throw new BadRequestException('Ya tienes el plan team.');
    }
    if (user.userPlan === 'pro' && plan === 'pro') {
      throw new BadRequestException('Ya tienes el plan pro.');
    }

    const stripe = new Stripe(stripeKey);
    let customerId: string | undefined = undefined;
    // Si el usuario ya tenia cliente de stripe, lo reusamos en la sesion
    if (
      user.stripeCustomerId !== null &&
      user.stripeCustomerId !== undefined &&
      user.stripeCustomerId.trim() !== ''
    ) {
      customerId = user.stripeCustomerId;
    }

    try {
      type CheckoutSessionPayload = Parameters<
        typeof stripe.checkout.sessions.create
      >[0];
      // Armamos el payload base para crear la sesion de pago
      const checkoutPayload: CheckoutSessionPayload = {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: userId,
        metadata: {
          appUserId: userId,
          targetPlan: plan,
        },
      };
      if (customerId !== undefined) {
        // Si hay cliente guardado, se usa ese id
        checkoutPayload.customer = customerId;
      } else {
        // Si no hay cliente, stripe lo crea usando email
        checkoutPayload.customer_email = user.email;
      }
      const session = await stripe.checkout.sessions.create(checkoutPayload);

      if (session.url === null || session.url === undefined) {
        throw new InternalServerErrorException('URL de checkout no valida.');
      }

      return { url: session.url };
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Error desconocido';
      throw new BadRequestException('Error al crear sesion: ' + message);
    }
  }

  /**
   * Abre portal de stripe para gestionar suscripcion
   */
  async createPortalSession(userId: string): Promise<{ url: string }> {
    const stripeKey = this.getRequiredStringConfig(
      'STRIPE_SECRET_KEY',
      'Stripe no configurado.',
    );
    const returnUrl = this.getRequiredStringConfig(
      'STRIPE_PORTAL_RETURN_URL',
      'Falta STRIPE_PORTAL_RETURN_URL.',
    );

    const user = await this.usersService.findById(userId);
    if (user === null) {
      throw new NotFoundException('Usuario no existe.');
    }
    let customerId: string | null = null;
    if (
      user.stripeCustomerId !== null &&
      user.stripeCustomerId !== undefined &&
      user.stripeCustomerId.trim() !== ''
    ) {
      customerId = user.stripeCustomerId;
    }
    if (customerId === null) {
      throw new BadRequestException('No hay cliente de Stripe.');
    }

    const stripe = new Stripe(stripeKey);
    try {
      // Abre el portal para que el usuario gestione su suscripcion recbida
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      if (portalSession.url === null || portalSession.url === undefined) {
        throw new InternalServerErrorException('URL de portal no valida.');
      }
      return { url: portalSession.url };
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Error desconocido';
      throw new BadRequestException('Error al abrir portal: ' + message);
    }
  }

  /**
   * Valida firma y procesa eventos recibidos desde stripe
   */
  async handleStripeWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: true }> {
    const stripeKey = this.getRequiredStringConfig(
      'STRIPE_SECRET_KEY',
      'Stripe no configurado.',
    );
    const webhookSecret = this.getRequiredStringConfig(
      'STRIPE_WEBHOOK_SECRET',
      'Falta STRIPE_WEBHOOK_SECRET.',
    );
    const stripe = new Stripe(stripeKey);

    let event: { type: string; data: { object: unknown } };
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Firma no valida.');
    }

    if (event.type === 'checkout.session.completed') {
      // Lee datos de sesion para actualizar plan en nuestro usuario
      const session = event.data.object as {
        metadata?: Record<string, string>;
        client_reference_id?: string | null;
        customer?: unknown;
        subscription?: unknown;
      };
      let appUserId = '';
      if (session.metadata && typeof session.metadata.appUserId === 'string') {
        appUserId = session.metadata.appUserId;
      } else if (
        typeof session.client_reference_id === 'string' &&
        session.client_reference_id.trim() !== ''
      ) {
        appUserId = session.client_reference_id;
      }
      let targetPlan = '';
      if (session.metadata && typeof session.metadata.targetPlan === 'string') {
        targetPlan = session.metadata.targetPlan;
      }

      if (appUserId.trim() === '') {
        throw new BadRequestException('Webhook sin appUserId.');
      }
      if (targetPlan !== 'pro' && targetPlan !== 'team') {
        throw new BadRequestException('Plan no valido.');
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
      // Cuando stripe cierra suscripcion, bajamos el plan en la app
      const subscription = event.data.object as {
        customer?: unknown;
        id?: string;
      };
      const customerId = this.getStripeObjectId(subscription.customer);
      let subscriptionId: string | null = null;
      if (
        typeof subscription.id === 'string' &&
        subscription.id.trim() !== ''
      ) {
        subscriptionId = subscription.id;
      }
      if (customerId !== null && customerId.trim() !== '') {
        await this.usersService.downgradeToFreeOnStripeEnd(
          customerId,
          subscriptionId,
        );
      }
    }

    return { received: true };
  }

  /**
   * Lee una variable obligatoria del entorno
   */
  private getRequiredStringConfig(key: string, errorMessage: string): string {
    const value = this.configService.get<string>(key);
    if (value === undefined || value === null || value.trim() === '') {
      throw new InternalServerErrorException(errorMessage);
    }
    return value;
  }

  /**
   * Extrae id de un objeto stripe cuando existe
   */
  private getStripeObjectId(value: unknown): string | null {
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
