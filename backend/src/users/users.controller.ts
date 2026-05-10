import {
  Controller,
  Get,
  Patch,
  Body,
  BadRequestException,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Delete,
  Param,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateUserDto } from './dto/update-user.dto';
import type { ValidatedRequest } from '../auth/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { canManageUsers } from '../casl/named-policy.handlers';

interface UploadedFileWithBuffer {
  buffer: Buffer;
}

type MulterFileLike = { mimetype: string };

type MulterFileFilterCallback = (
  error: Error | null,
  acceptFile: boolean,
) => void;

/**
 * Valida que el archivo de avatar sea una imagen
 */
function avatarImageFileFilter(
  _req: unknown,
  file: MulterFileLike,
  next: MulterFileFilterCallback,
) {
  if (!file.mimetype.startsWith('image/')) {
    next(new BadRequestException('Archivo no valido.'), false);
    return;
  }
  next(null, true);
}

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  /**
   * Inyecta servicios de usuarios y cloudinary
   */
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Devuelve el perfil del usuario autenticado
   */
  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil logueado' })
  async getProfile(@Request() authenticatedRequest: ValidatedRequest) {
    return this.usersService.findOne(authenticatedRequest.user.sub);
  }

  /**
   * Elimina la cuenta del usuario autenticado
   */
  @Delete('me')
  @ApiOperation({ summary: 'Eliminar cuenta del usuario logueado' })
  async deleteAccount(@Request() authenticatedRequest: ValidatedRequest) {
    // Carga usuario para limpiar avatar antes de borrar la cuenta
    const currentUser = await this.usersService.findById(
      authenticatedRequest.user.sub,
    );
    let previousAvatarUrl: string | undefined;
    if (currentUser !== null) {
      previousAvatarUrl = currentUser.avatarUrl;
    }
    if (previousAvatarUrl !== undefined && previousAvatarUrl !== null) {
      if (previousAvatarUrl !== '') {
        const publicId =
          this.cloudinaryService.extractPublicId(previousAvatarUrl);
        if (publicId !== null && publicId !== '') {
          // Borra el avatar viejo para no dejar archivo huerfano en cloudinary
          await this.cloudinaryService.deleteFile(publicId);
        }
      }
    }
    await this.usersService.remove(authenticatedRequest.user.sub);
    return { message: 'Cuenta eliminada.' };
  }

  /**
   * Actualiza perfil y avatar del usuario autenticado
   */
  @Patch('me')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: avatarImageFileFilter,
    }),
  )
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
    @Request() authenticatedRequest: ValidatedRequest,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() file?: unknown,
  ) {
    const uploaded = file as UploadedFileWithBuffer | undefined;
    const shouldRemoveAvatarOnly =
      (uploaded === undefined || uploaded.buffer === undefined) &&
      updateUserDto.avatarUrl !== undefined &&
      updateUserDto.avatarUrl.trim() === '';

    if (uploaded !== undefined && uploaded.buffer !== undefined) {
      // Si llega imagen nueva, primero borra avatar anterior
      const currentUser = await this.usersService.findById(
        authenticatedRequest.user.sub,
      );
      let previousAvatarUrl: string | undefined;
      if (currentUser !== null) {
        previousAvatarUrl = currentUser.avatarUrl;
      }
      if (previousAvatarUrl !== undefined && previousAvatarUrl !== null) {
        if (previousAvatarUrl !== '') {
          const publicId =
            this.cloudinaryService.extractPublicId(previousAvatarUrl);
          if (publicId !== null && publicId !== '') {
            // Borra el avatar viejo para no dejar archivo huerfano en cloudinary
            await this.cloudinaryService.deleteFile(publicId);
          }
        }
      }
      // Luego sube avatar nuevo y guarda url en el dto del perfil
      const uploadResult = await this.cloudinaryService.uploadFile({
        buffer: uploaded.buffer,
      });
      updateUserDto.avatarUrl = uploadResult.secure_url;
    }
    if (shouldRemoveAvatarOnly) {
      // Si el cliente pide quitar avatar sin subir uno nuevo, limpiamos remoto
      const currentUser = await this.usersService.findById(
        authenticatedRequest.user.sub,
      );
      let previousAvatarUrl: string | undefined;
      if (currentUser !== null) {
        previousAvatarUrl = currentUser.avatarUrl;
      }
      if (previousAvatarUrl !== undefined && previousAvatarUrl !== null) {
        if (previousAvatarUrl !== '') {
          const publicId =
            this.cloudinaryService.extractPublicId(previousAvatarUrl);
          if (publicId !== null && publicId !== '') {
            await this.cloudinaryService.deleteFile(publicId);
          }
        }
      }
      updateUserDto.avatarUrl = '';
    }

    return this.usersService.update(
      authenticatedRequest.user.sub,
      updateUserDto,
    );
  }

  /**
   * Busca usuarios para invitar excluyendo el usuario actual
   */
  @Get('search')
  @ApiOperation({ summary: 'Buscar usuarios para invitar (autenticado)' })
  @ApiQuery({
    name: 'text',
    required: false,
    description:
      'Texto a buscar en nombre de usuario o email (mínimo 2 caracteres en el servicio)',
  })
  async searchUsers(
    @Query('text') searchTextFromQuery: string,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    let searchTextForInvite = '';
    if (searchTextFromQuery !== undefined && searchTextFromQuery !== null) {
      searchTextForInvite = searchTextFromQuery;
    }
    // Excluye al usuario actual para no poder invitarse a si msimo
    const currentUserId = authenticatedRequest.user.sub;
    return this.usersService.searchForInvite(
      searchTextForInvite,
      currentUserId,
    );
  }

  /**
   * Lista usuarios para administracion
   */
  @Get()
  @UseGuards(PoliciesGuard)
  @CheckPolicies(canManageUsers)
  @ApiOperation({ summary: 'Obtener todos los usuarios (solo admin)' })
  async findAllUsers() {
    return this.usersService.findAll();
  }

  /**
   * Actualiza un usuario por id con permisos de admin
   */
  @Patch(':id')
  @UseGuards(PoliciesGuard)
  @CheckPolicies(canManageUsers)
  @ApiOperation({ summary: 'Editar cualquier usuario (solo admin)' })
  async updateUserById(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  /**
   * Elimina un usuario por id con permisos de admin
   */
  @Delete(':id')
  @UseGuards(PoliciesGuard)
  @CheckPolicies(canManageUsers)
  @ApiOperation({ summary: 'Eliminar cualquier usuario (solo admin)' })
  async deleteUserById(@Param('id') id: string) {
    // Admin borra usuario y tambien limpia avatar remoto
    const userToDelete = await this.usersService.findById(id);
    let previousAvatarUrl: string | undefined;
    if (userToDelete !== null) {
      previousAvatarUrl = userToDelete.avatarUrl;
    }
    if (previousAvatarUrl !== undefined && previousAvatarUrl !== null) {
      if (previousAvatarUrl !== '') {
        const publicId =
          this.cloudinaryService.extractPublicId(previousAvatarUrl);
        if (publicId !== null && publicId !== '') {
          // Borra el avatar viejo para no dejar archivo huerfano en cloudinary
          await this.cloudinaryService.deleteFile(publicId);
        }
      }
    }
    await this.usersService.remove(id);
    return {
      message: 'Usuario eliminado.',
    };
  }
}
