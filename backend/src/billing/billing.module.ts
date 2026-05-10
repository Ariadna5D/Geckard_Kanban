import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { UsersModule } from '../users/users.module';

/**
 * Modulo de facturacion
 */
@Module({
  // UsersModule para busqueda de usuario y plan
  imports: [UsersModule],
  providers: [BillingService],
  controllers: [BillingController],
})
export class BillingModule {}
