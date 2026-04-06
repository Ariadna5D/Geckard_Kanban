import { Injectable, Inject } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import * as streamifier from 'streamifier';
import { Readable } from 'stream';
import { CLOUDINARY } from './cloudinary.provider';

interface MulterFile {
  buffer: Buffer;
}

@Injectable()
export class CloudinaryService {
  constructor(@Inject(CLOUDINARY) private cloudinaryConfig: any) {}

  /**
   * Sube la imagen del avatar: la recorta cuadrada y la deja en la carpeta “avatars”.
   */
  async uploadFile(file: MulterFile): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'avatars',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        this.handleUploadStreamResult.bind(this, resolve, reject),
      );
      const streamService = streamifier as {
        createReadStream: (b: Buffer) => Readable;
      };
      streamService.createReadStream(Buffer.from(file.buffer)).pipe(uploadStream);
    });
  }

  private handleUploadStreamResult(
    resolve: (r: UploadApiResponse) => void,
    reject: (e: Error) => void,
    error: UploadApiErrorResponse | undefined,
    result: UploadApiResponse | undefined,
  ) {
    if (error) {
      reject(new Error(`Cloudinary Error: ${error.message}`));
      return;
    }
    if (!result) {
      reject(new Error('Cloudinary result is undefined'));
      return;
    }
    resolve(result);
  }

  /**
   * De la URL pública sacamos el “nombre interno” que Cloudinary usa para borrar.
   */
  extractPublicId(url: string): string | null {
    if (!url) return null;

    try {
      const parts = url.split('/upload/');
      if (parts.length < 2) return null;

      let finalPart = parts[1];

      if (finalPart.match(/^v\d+\//)) {
        finalPart = finalPart.replace(/^v\d+\//, '');
      }

      const extensionIndex = finalPart.lastIndexOf('.');
      const publicId =
        extensionIndex !== -1
          ? finalPart.substring(0, extensionIndex)
          : finalPart;

      return publicId;
    } catch (error) {
      console.error('Error extrayendo publicId:', error);
      return null;
    }
  }

  /**
   * Borra la imagen en la nube cuando cambias de avatar o cierras cuenta.
   */
  async deleteFile(publicId: string): Promise<{ result: string }> {
    try {
      const result = (await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
      })) as {
        result: string;
      };

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Cloudinary Delete Error: ${error.message}`);
      }
      throw new Error(`Cloudinary Delete Error: ${String(error)}`);
    }
  }
}
