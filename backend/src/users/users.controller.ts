import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Delete,
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
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PoliciesGuard } from 'src/casl/policies.guard';
import { CheckPolicies } from 'src/casl/policies.decorator';
import { User } from './schemas/user.schema';
import { Action } from 'src/casl/casl-ability.factory';

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
    return this.usersService.findOne(req.user.sub);
  }

  /**
   *  Eliminar la cuenta del usuario logueado, incluyendo la eliminación de su avatar en Cloudinary si existe
   * @param req  - La solicitud autenticada que contiene la información del usuario
   * @returns  Un mensaje de confirmación de que la cuenta y los datos asociados han sido eliminados correctamente
   */
  @Delete('me')
  @ApiOperation({ summary: 'Eliminar cuenta del usuario logueado' })
  async deleteAccount(@Request() req: ValidatedRequest) {
    const currentUser = await this.usersService.findById(req.user.sub);

    if (currentUser && currentUser.avatarUrl) {
      const publicId = this.cloudinaryService.extractPublicId(
        currentUser.avatarUrl,
      );
      if (publicId) {
        await this.cloudinaryService.deleteFile(publicId);
      }
    }

    await this.usersService.remove(req.user.sub);

    return { message: 'Cuenta y datos asociados eliminados correctamente' };
  }

  /**
   *  Obtener todos los usuarios registrados en la plataforma (Solo accesible para administradores)
   * @returns  Una lista de todos los usuarios registrados, excluyendo sus contraseñas hasheadas por razones de seguridad
   * @throws ForbiddenException si el usuario autenticado no tiene permisos de administrador para acceder a esta información
   */
  @Get()
  @UseGuards(JwtAuthGuard, PoliciesGuard) // 1. Exige estar logueado, 2. Exige pasar el filtro de CASL
  @CheckPolicies((ability) => ability.can(Action.Manage, User)) // La regla de oro
  @ApiOperation({ summary: 'Obtener todos los usuarios (Solo Admin)' })
  async findAllUsers() {
    return this.usersService.findAll();
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
      const currentUser = await this.usersService.findById(req.user.sub);

      if (currentUser && currentUser.avatarUrl) {
        const publicId = this.cloudinaryService.extractPublicId(
          currentUser.avatarUrl,
        );
        if (publicId) {
          await this.cloudinaryService.deleteFile(publicId);
        }
      }

      const uploadResult = await this.cloudinaryService.uploadFile({
        buffer: safeFile.buffer,
      });

      updateUserDto.avatarUrl = uploadResult.secure_url;
    }

    return this.usersService.update(req.user.sub, updateUserDto);
  }
}
