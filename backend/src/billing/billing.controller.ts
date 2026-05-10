import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import type { RawBodyRequest } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { ValidatedRequest } from '../auth/interfaces/jwt-payload.interface';
import { BillingService } from './billing.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  /**
   * Inyecta el servicio de cobros y webhooks
   */
  constructor(private readonly billingService: BillingService) {}

  /**
   * Crea sesion de checkout para el usuario autenticado
   */
  @Post('checkout-session')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Crear sesión de pago Stripe (pro o team)' })
  createCheckoutSession(
    @Request() authenticatedRequest: ValidatedRequest,
    @Body() dto: CreateCheckoutSessionDto,
  ): Promise<{ url: string }> {
    // Usa el usuario de la sesion para crear checkout sin ids del cliente
    return this.billingService.createCheckoutSession(
      authenticatedRequest.user.sub,
      dto.plan,
    );
  }

  /**
   * Crea sesion del portal de cliente de stripe
   */
  @Post('customer-portal')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Abrir portal de Stripe (cancelar suscripción, facturas, tarjeta)',
  })
  createPortalSession(
    @Request() authenticatedRequest: ValidatedRequest,
  ): Promise<{ url: string }> {
    // Abre portal del cliente asociado al usuario autenticado
    return this.billingService.createPortalSession(
      authenticatedRequest.user.sub,
    );
  }

  /**
   * Recibe eventos webhook de stripe con body crudo
   */
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook de Stripe para confirmar pagos' })
  handleWebhook(
    @Req() rawRequest: RawBodyRequest<ExpressRequest>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    if (signature === undefined || signature.trim() === '') {
      throw new BadRequestException('Firma no valida.');
    }
    // Stripe exige rawBody exacto para verificar firma del evento
    if (rawRequest.rawBody === undefined) {
      throw new BadRequestException('Body no valido.');
    }
    return this.billingService.handleStripeWebhook(
      rawRequest.rawBody,
      signature,
    );
  }
}
