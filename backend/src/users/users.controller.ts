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

// Para validar que el archivo subido es una imagen, evitando que se suban otros tipos de archivos
type MulterFileLike = { mimetype: string };

type MulterFileFilterCallback = (
  error: Error | null,
  acceptFile: boolean,
) => void;

// Filtro para multer que solo acepta archivos de imagen para el avatar
function avatarImageFileFilter(
  _req: unknown,
  file: MulterFileLike,
  next: MulterFileFilterCallback,
) {
  if (!file.mimetype.startsWith('image/')) {
    next(
      new BadRequestException(
        'Solo se permiten archivos de imagen para el avatar.',
      ),
      false,
    );
    return;
  }
  next(null, true);
}

// Función auxiliar para eliminar el avatar anterior de Cloudinary si existe, evitando acumular archivos no usados
async function deleteCloudinaryAvatarIfPresent(
  cloudinary: CloudinaryService, // Inyectamos el servicio de Cloudinary para poder eliminar el archivo
  avatarUrl: string | undefined | null,
) {
  if (avatarUrl === undefined || avatarUrl === null) {
    return;
  }
  if (avatarUrl === '') {
    return;
  }
  const publicId = cloudinary.extractPublicId(avatarUrl);
  if (publicId !== null && publicId !== '') {
    await cloudinary.deleteFile(publicId); // Elimina el archivo de Cloudinary usando su public ID
  }
}

/**
 * Controlador para gestionar usuarios. Rutas protegidas con JWT y algunas solo para Admin.
 */
@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // GET del usuario logueado
  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil logueado' })
  async getProfile(@Request() req: ValidatedRequest) {
    return this.usersService.findOne(req.user.sub); // req.user.sub es el id del usuario logueado, extraído del token JWT por JwtStrategy
  }

  // DELETE usuario logueado
  @Delete('me')
  @ApiOperation({ summary: 'Eliminar cuenta del usuario logueado' })
  async deleteAccount(@Request() req: ValidatedRequest) {
    const currentUser = await this.usersService.findById(req.user.sub);
    let oldAvatar: string | undefined;
    if (currentUser !== null) {
      oldAvatar = currentUser.avatarUrl;
    }
    await deleteCloudinaryAvatarIfPresent(this.cloudinaryService, oldAvatar);
    await this.usersService.remove(req.user.sub);
    return { message: 'Cuenta y datos asociados eliminados correctamente' };
  }

  // PATCH usuario logueado
  @Patch('me')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB para el archivo
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
    @Request() req: ValidatedRequest,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() file?: unknown,
  ) {
    const uploaded = file as UploadedFileWithBuffer | undefined;

    // Si se subió un nuevo avatar, lo subimos a Cloudinary y actualizamos el avatarUrl del usuario
    if (uploaded !== undefined && uploaded.buffer !== undefined) {
      const currentUser = await this.usersService.findById(req.user.sub);
      let oldAvatar: string | undefined;
      if (currentUser !== null) {
        oldAvatar = currentUser.avatarUrl;
      }
      await deleteCloudinaryAvatarIfPresent(this.cloudinaryService, oldAvatar); // Elimina el avatar anterior de Cloudinary si existía
      const uploadResult = await this.cloudinaryService.uploadFile({
        buffer: uploaded.buffer,
      });
      updateUserDto.avatarUrl = uploadResult.secure_url;
    }

    return this.usersService.update(req.user.sub, updateUserDto);
  }

  /**
   * Busca usuarios por texto en nombre de usuario o email, para invitar a tableros. Excluye al usuario que hace la búsqueda
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
    const currentUserId = authenticatedRequest.user.sub;
    return this.usersService.searchForInvite(
      searchTextForInvite,
      currentUserId,
    );
  }

  /**
   * RUTAS DE ADNIMINSTRACION DE USUARIOS - SOLO PARA ADMINISTRADORES
   */
  @Get()
  @UseGuards(PoliciesGuard) // Protegemos esta ruta con el guard de políticas de CASL
  @CheckPolicies(canManageUsers)
  @ApiOperation({ summary: 'Obtener todos los usuarios (Solo Admin)' })
  async findAllUsers() {
    return this.usersService.findAll();
  }

  @Patch(':id')
  @UseGuards(PoliciesGuard)
  @CheckPolicies(canManageUsers)
  @ApiOperation({ summary: 'Editar cualquier usuario (Solo Admin)' })
  async updateUserById(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(PoliciesGuard)
  @CheckPolicies(canManageUsers)
  @ApiOperation({ summary: 'Eliminar cualquier usuario (Solo Admin)' })
  async deleteUserById(@Param('id') id: string) {
    const userToDelete = await this.usersService.findById(id);
    let oldAvatar: string | undefined;
    if (userToDelete !== null) {
      oldAvatar = userToDelete.avatarUrl;
    }
    await deleteCloudinaryAvatarIfPresent(this.cloudinaryService, oldAvatar);
    await this.usersService.remove(id);
    return {
      message: 'Usuario con ID ' + id + ' eliminado correctamente del sistema.',
    };
  }
}
