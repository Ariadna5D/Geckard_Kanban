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
  constructor(private readonly billingService: BillingService) {}

  @Post('checkout-session')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Crear sesión de pago Stripe (pro o team)' })
  async createCheckoutSession(
    @Request() req: ValidatedRequest,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    return this.billingService.createCheckoutSession(req.user.sub, dto.plan);
  }

  @Post('customer-portal')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Abrir portal de Stripe (cancelar suscripción, facturas, tarjeta)',
  })
  async createCustomerPortalSession(@Request() req: ValidatedRequest) {
    return this.billingService.createCustomerPortalSession(req.user.sub);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook de Stripe para confirmar pagos' })
  async handleWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    if (signature === undefined || signature.trim() === '') {
      throw new BadRequestException('Falta cabecera stripe-signature.');
    }
    if (req.rawBody === undefined) {
      throw new BadRequestException(
        'rawBody no disponible. Revisa NestFactory.create(..., { rawBody: true }).',
      );
    }
    return this.billingService.handleStripeWebhook(req.rawBody, signature);
  }
}
