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

  // Método para subir un archivo a Cloudinary
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
}
