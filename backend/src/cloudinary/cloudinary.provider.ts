import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

export const CLOUDINARY = 'Cloudinary';

/**
 * Lee credenciales de entorno y deja el cliente de Cloudinary listo para subir/borrar.
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

  // Si faltan datos, Cloudinary puede fallar al subir
  return cloudinary.config({
    cloud_name: cloudName === '' ? undefined : cloudName,
    api_key: apiKey === '' ? undefined : apiKey,
    api_secret: apiSecret === '' ? undefined : apiSecret,
  });
}

export const CloudinaryProvider = {
  provide: CLOUDINARY,
  inject: [ConfigService],
  useFactory: configureCloudinaryFromEnv,
};
