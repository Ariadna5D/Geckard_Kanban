import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateUserDto } from './dto/update-user.dto';
import type { ValidatedRequest } from '../auth/interfaces/jwt-payload.interface';

// Interfaz para definir la estructura del archivo subido, asegurando que tenga un buffer para la carga a Cloudinary
interface UploadedFileMetadata {
  buffer: Buffer;
}

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Obtener el perfil del usuario logueado
   * @param req - La solicitud autenticada que contiene la información del usuario
   * @returns El perfil del usuario logueado
   */
  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil logueado' })
  async getProfile(@Request() req: ValidatedRequest) {
    return this.usersService.findById(req.user.sub);
  }

  /**
   * Actualizar el perfil del usuario logueado, incluyendo la posibilidad de subir una nueva imagen de avatar
   * @param req - La solicitud autenticada que contiene la información del usuario
   * @param updateUserDto - Los datos para actualizar el perfil del usuario
   * @param file - El archivo de imagen para el avatar (opcional)
   * @returns El perfil actualizado del usuario logueado
   */
  @Patch('me')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar perfil logueado' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        email: { type: 'string' },
        bio: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async updateProfile(
    @Request() req: ValidatedRequest,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() file?: unknown,
  ) {
    const safeFile = file as UploadedFileMetadata | undefined;

    if (safeFile?.buffer) {
      const uploadResult = await this.cloudinaryService.uploadFile({
        buffer: safeFile.buffer,
      });
      updateUserDto.avatarUrl = uploadResult.secure_url;
    }

    return this.usersService.update(req.user.sub, updateUserDto);
  }
}
