import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

export const CLOUDINARY = 'Cloudinary';

/**
 * Configura cloudinary
 */
function configureCloudinaryFromEnv(configService: ConfigService) {
  const cloudNameRaw = configService.get<string>('CLOUDINARY_CLOUD_NAME');
  const apiKeyRaw = configService.get<string>('CLOUDINARY_API_KEY');
  const apiSecretRaw = configService.get<string>('CLOUDINARY_API_SECRET');

  let cloudName = '';
  if (cloudNameRaw !== undefined && cloudNameRaw !== null) {
    cloudName = cloudNameRaw.trim();
  }
  let apiKey = '';
  if (apiKeyRaw !== undefined && apiKeyRaw !== null) {
    apiKey = apiKeyRaw.trim();
  }
  let apiSecret = '';
  if (apiSecretRaw !== undefined && apiSecretRaw !== null) {
    apiSecret = apiSecretRaw.trim();
  }

  // Preparar valores y dejar undefined cuando estan vacios
  let cloudNameForConfig: string | undefined = undefined;
  if (cloudName !== '') {
    cloudNameForConfig = cloudName;
  }
  let apiKeyForConfig: string | undefined = undefined;
  if (apiKey !== '') {
    apiKeyForConfig = apiKey;
  }
  let apiSecretForConfig: string | undefined = undefined;
  if (apiSecret !== '') {
    apiSecretForConfig = apiSecret;
  }

  // Aplicar configuracion final
  return cloudinary.config({
    cloud_name: cloudNameForConfig,
    api_key: apiKeyForConfig,
    api_secret: apiSecretForConfig,
  });
}

export const CloudinaryProvider = {
  provide: CLOUDINARY,
  inject: [ConfigService],
  useFactory: configureCloudinaryFromEnv,
};
