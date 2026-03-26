import { Injectable, Inject } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import * as streamifier from 'streamifier';
import { Readable } from 'stream';
import { CLOUDINARY } from './cloudinary.provider';

// Definimos una interfaz para el archivo que recibimos de Multer
interface MulterFile {
  buffer: Buffer;
}

@Injectable()
export class CloudinaryService {
  constructor(@Inject(CLOUDINARY) private cloudinaryConfig: any) {}

  /**
   * Sube un archivo a Cloudinary
   * @param file - El archivo a subir
   * @returns Respuesta de Cloudinary, incluyendo la URL segura del archivo subido.
   * @throws Error si ocurre un problema durante la carga a Cloudinary.
   */
  async uploadFile(file: MulterFile): Promise<UploadApiResponse> {
    // Cloudinary no tiene un método directo para subir desde un Buffer, así que usamos un Stream
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'avatars', // Guardamos las imágenes en una carpeta "avatars" para mantener orden
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' }, // Recortamos a 400x400 centrado
            { quality: 'auto', fetch_format: 'auto' }, // Optimizamos la imagen automáticamente para web
          ],
        },
        (
          error: UploadApiErrorResponse | undefined, // El error que Cloudinary pueda devolver
          result: UploadApiResponse | undefined, // El resultado exitoso que incluye la URL segura
        ) => {
          if (error)
            return reject(new Error(`Cloudinary Error: ${error.message}`));
          if (!result)
            return reject(new Error('Cloudinary result is undefined'));

          resolve(result); // Si todo va bien, resolvemos la promesa con el resultado de Cloudinary
        },
      );
      // Convertimos el Buffer del archivo en un Stream de lectura para que Cloudinary pueda procesarlo
      const bufferToStream = Buffer.from(file.buffer);

      // streamifier es una librería que nos ayuda a convertir un Buffer en un Stream de lectura
      const streamService = streamifier as {
        createReadStream: (b: Buffer) => Readable;
      };

      // Pipeamos el Stream de lectura al uploadStream de Cloudinary
      streamService.createReadStream(bufferToStream).pipe(uploadStream);
    });
  }

  // ... tu código anterior (uploadFile) ...

  /**
   * Extrae el public_id de una URL segura de Cloudinary
   * @returns El public_id en formato "folder/filename" o null si no se puede extraer
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
   * Borra un archivo de Cloudinary usando su public_id
   * @param publicId - El public_id del archivo a borrar (ej: "avatars/abcd")
   * @returns La respuesta de Cloudinary sobre la operación de borrado
   * @throws Error si ocurre un problema durante el borrado en Cloudinary
   */
  async deleteFile(publicId: string): Promise<{ result: string }> {
    try {
      console.log(`[Cloudinary] Intentando borrar public_id: ${publicId}`);

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
