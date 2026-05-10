import {
  Injectable,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadResponseCallback,
} from 'cloudinary';
import * as streamifier from 'streamifier';
import { Readable } from 'stream';
import { CLOUDINARY } from './cloudinary.provider';

interface MulterFile {
  buffer: Buffer;
}

/**
 * Quita prefijo de version en rutas de cloudinary
 */
function stripVersionFolderPrefix(pathAfterUpload: string): string {
  if (pathAfterUpload.length < 2) {
    return pathAfterUpload;
  }
  if (pathAfterUpload[0] !== 'v') {
    return pathAfterUpload;
  }
  let digitIndex = 1;
  while (digitIndex < pathAfterUpload.length) {
    const character = pathAfterUpload[digitIndex];
    const isDigit = character >= '0' && character <= '9';
    if (!isDigit) {
      break;
    }
    digitIndex++;
  }
  if (
    digitIndex < pathAfterUpload.length &&
    pathAfterUpload[digitIndex] === '/'
  ) {
    return pathAfterUpload.substring(digitIndex + 1);
  }
  return pathAfterUpload;
}

function removeFileExtension(filePath: string): string {
  let lastDotIndex = -1;
  for (let index = 0; index < filePath.length; index++) {
    if (filePath[index] === '.') {
      lastDotIndex = index;
    }
  }
  if (lastDotIndex === -1) {
    return filePath;
  }
  return filePath.substring(0, lastDotIndex);
}

function buildCloudinaryUploadException(errorMessage: string) {
  const normalizedMessage = errorMessage.toLowerCase();
  const isTimeoutError =
    normalizedMessage.includes('timeout') ||
    normalizedMessage.includes('timed out') ||
    normalizedMessage.includes('etimedout');
  const isConnectionError =
    normalizedMessage.includes('econnreset') ||
    normalizedMessage.includes('enotfound') ||
    normalizedMessage.includes('eai_again') ||
    normalizedMessage.includes('socket hang up');

  if (isTimeoutError || isConnectionError) {
    return new ServiceUnavailableException(
      'No se pudo subir la imagen por un problema de conexión con Cloudinary. Inténtalo de nuevo en unos segundos.',
    );
  }

  return new ServiceUnavailableException(
    'No se pudo subir la imagen en este momento. Inténtalo de nuevo más tarde.',
  );
}

function extractUnknownErrorMessage(unknownError: unknown): string {
  if (unknownError instanceof Error) {
    return unknownError.message;
  }

  if (unknownError !== null && typeof unknownError === 'object') {
    const record = unknownError as Record<string, unknown>;

    if (typeof record.message === 'string' && record.message.trim() !== '') {
      return record.message;
    }
    if (typeof record.error?.['message'] === 'string') {
      return String(record.error['message']);
    }
    if (typeof record.http_code === 'number') {
      return `Cloudinary respondió con código ${record.http_code}`;
    }

    try {
      return JSON.stringify(record);
    } catch {
      return 'Error remoto sin detalle legible';
    }
  }

  return String(unknownError);
}

@Injectable()
export class CloudinaryService {
  /**
   * Inyecta configuracion de cloudinary para iniciar el servicio
   */
  constructor(
    @Inject(CLOUDINARY)
    private readonly cloudinaryConfigurationResult: unknown,
  ) {
    void this.cloudinaryConfigurationResult;
  }

  /**
   * Sube una imagen de avatar a cloudinary
   */
  async uploadFile(file: MulterFile): Promise<UploadApiResponse> {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      // Preparar callback para exito o error del stream
      const uploadCallback: UploadResponseCallback = (error, result) => {
        if (error !== undefined && error !== null) {
          reject(buildCloudinaryUploadException(error.message));
          return;
        }
        if (result === undefined || result === null) {
          reject(new Error('Respuesta de Cloudinary no valida'));
          return;
        }
        resolve(result);
      };

      // Crear stream de subida con transformacion de avatar
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'avatars',
          timeout: 60000,
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        uploadCallback,
      );

      const streamHelpers = streamifier as {
        createReadStream: (buffer: Buffer) => Readable;
      };
      const bufferCopy = Buffer.from(file.buffer);
      const readableFromBuffer = streamHelpers.createReadStream(bufferCopy);
      // Enviar buffer sin escribir archivo temporal en disco
      readableFromBuffer.pipe(uploadStream);
    });
  }

  /**
   * Extrae public id de una url completa de cloudinary
   */
  extractPublicId(imageUrl: string): string | null {
    if (imageUrl === undefined || imageUrl === null) {
      return null;
    }
    if (imageUrl.trim() === '') {
      return null;
    }

    const segments = imageUrl.split('/upload/');
    if (segments.length < 2) {
      return null;
    }

    let pathAfterUpload = segments[1];
    pathAfterUpload = stripVersionFolderPrefix(pathAfterUpload);
    const publicId = removeFileExtension(pathAfterUpload);

    // Si no queda texto util, no intentamos borrar archivo
    if (publicId.trim() === '') {
      return null;
    }
    return publicId;
  }

  /**
   * Elimina archivo remoto en cloudinary por public id
   */
  async deleteFile(publicId: string): Promise<{ result: string }> {
    try {
      const destroyResult = (await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
      })) as {
        result: string;
      };
      return destroyResult;
    } catch (unknownError) {
      // A veces Cloudinary devuelve objetos en vez de Error nativo
      const message = extractUnknownErrorMessage(unknownError);
      throw new Error('Error al borrar en Cloudinary: ' + message);
    }
  }
}
