import { Injectable, Inject } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
  UploadResponseCallback,
} from 'cloudinary';
import * as streamifier from 'streamifier';
import { Readable } from 'stream';
import { CLOUDINARY } from './cloudinary.provider';

interface MulterFile {
  buffer: Buffer;
}

// Adapta la URL de Cloudinary para obtener el publicId que espera al borrar
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

// Quita la extension del archivo para obtener el publicId que espera Cloudinary al borrar
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

// SERVICIO ///////////////////////////////////
@Injectable()
export class CloudinaryService {
  constructor(
    @Inject(CLOUDINARY)
    private readonly cloudinaryConfigurationResult: unknown,
  ) {
    void this.cloudinaryConfigurationResult;
  }

  // SUBIDA DE IMAGEN
  async uploadFile(file: MulterFile): Promise<UploadApiResponse> {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadCallback: UploadResponseCallback = (error, result) => {
        this.handleUploadStreamResult(resolve, reject, error, result);
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'avatars',
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
      readableFromBuffer.pipe(uploadStream);
    });
  }

  // Subida de imagen con URL para swagger
  private handleUploadStreamResult(
    resolve: (response: UploadApiResponse) => void,
    reject: (reason: Error) => void,
    error: UploadApiErrorResponse | undefined,
    result: UploadApiResponse | undefined,
  ): void {
    if (error !== undefined && error !== null) {
      reject(new Error('Cloudinary Error: ' + error.message));
      return;
    }
    if (result === undefined || result === null) {
      reject(new Error('Cloudinary result is undefined'));
      return;
    }
    resolve(result);
  }

  // EXTRACCIÓN DE PUBLIC ID
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

    if (publicId.trim() === '') {
      return null;
    }
    return publicId;
  }

  // BORRADO DE IMAGEN
  async deleteFile(publicId: string): Promise<{ result: string }> {
    try {
      const destroyResult = (await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
      })) as {
        result: string;
      };
      return destroyResult;
    } catch (unknownError) {
      let message = 'error desconocido';
      if (unknownError instanceof Error) {
        message = unknownError.message;
      } else {
        message = String(unknownError);
      }
      throw new Error('Cloudinary Delete Error: ' + message);
    }
  }
}
