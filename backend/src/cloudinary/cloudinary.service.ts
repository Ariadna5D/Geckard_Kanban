import { Injectable } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import * as streamifier from 'streamifier';
import { Readable } from 'stream';

interface MulterFile {
  buffer: Buffer;
}

@Injectable()
export class CloudinaryService {
  async uploadFile(file: MulterFile): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'kanban_avatars',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error)
            return reject(new Error(`Cloudinary Error: ${error.message}`));
          if (!result)
            return reject(new Error('Cloudinary result is undefined'));
          resolve(result);
        },
      );

      const bufferToStream = Buffer.from(file.buffer);

      const streamService = streamifier as {
        createReadStream: (b: Buffer) => Readable;
      };

      streamService.createReadStream(bufferToStream).pipe(uploadStream);
    });
  }
}
