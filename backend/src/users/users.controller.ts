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
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateUserDto } from './dto/update-user.dto';
import type { ValidatedRequest } from '../auth/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PoliciesGuard } from 'src/casl/policies.guard';
import { CheckPolicies } from 'src/casl/policies.decorator';
import { canManageUsers } from 'src/casl/named-policy.handlers';

interface UploadedFileWithBuffer {
  buffer: Buffer;
}

type MulterFileLike = { mimetype: string };

type MulterFileFilterCallback = (
  error: Error | null,
  acceptFile: boolean,
) => void;

/**
 * Regla de Multer: rechaza todo lo que no sea imagen (para el avatar).
 */
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

/**
 * Si había foto antigua en Cloudinary, la borramos para no llenar la cuenta de basura.
 */
async function deleteCloudinaryAvatarIfPresent(
  cloudinary: CloudinaryService,
  avatarUrl: string | undefined | null,
) {
  if (!avatarUrl) return;
  const publicId = cloudinary.extractPublicId(avatarUrl);
  if (publicId) {
    await cloudinary.deleteFile(publicId);
  }
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
   * Devuelve los datos del usuario que está logueado ahora mismo.
   */
  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil logueado' })
  async getProfile(@Request() req: ValidatedRequest) {
    return this.usersService.findOne(req.user.sub);
  }

  /**
   * Borra la cuenta del usuario actual y su foto en la nube si tenía.
   */
  @Delete('me')
  @ApiOperation({ summary: 'Eliminar cuenta del usuario logueado' })
  async deleteAccount(@Request() req: ValidatedRequest) {
    const currentUser = await this.usersService.findById(req.user.sub);
    await deleteCloudinaryAvatarIfPresent(
      this.cloudinaryService,
      currentUser?.avatarUrl,
    );
    await this.usersService.remove(req.user.sub);
    return { message: 'Cuenta y datos asociados eliminados correctamente' };
  }

  /**
   * Cambia nombre, email, etc. Si viene archivo, sube avatar y borra el anterior.
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
    @Request() req: ValidatedRequest,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() file?: unknown,
  ) {
    const uploaded = file as UploadedFileWithBuffer | undefined;

    if (uploaded?.buffer) {
      const currentUser = await this.usersService.findById(req.user.sub);
      await deleteCloudinaryAvatarIfPresent(
        this.cloudinaryService,
        currentUser?.avatarUrl,
      );
      const uploadResult = await this.cloudinaryService.uploadFile({
        buffer: uploaded.buffer,
      });
      updateUserDto.avatarUrl = uploadResult.secure_url;
    }

    return this.usersService.update(req.user.sub, updateUserDto);
  }

  /**
   * Autocompletar usuarios al escribir en el modal de invitar al tablero.
   */
  @Get('search')
  @ApiOperation({ summary: 'Buscar usuarios para invitar (autenticado)' })
  async searchUsers(@Query('q') q: string, @Request() req: ValidatedRequest) {
    return this.usersService.searchForInvite(q ?? '', req.user.sub);
  }

  /**
   * Listado global: solo para administradores de la aplicación.
   */
  @Get()
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @CheckPolicies(canManageUsers)
  @ApiOperation({ summary: 'Obtener todos los usuarios (Solo Admin)' })
  async findAllUsers() {
    return this.usersService.findAll();
  }

  /**
   * Un admin puede editar a cualquier usuario desde el panel.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @CheckPolicies(canManageUsers)
  @ApiOperation({ summary: 'Editar cualquier usuario (Solo Admin)' })
  async updateUserById(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  /**
   * Un admin puede borrar cuentas; también quitamos su avatar de Cloudinary.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @CheckPolicies(canManageUsers)
  @ApiOperation({ summary: 'Eliminar cualquier usuario (Solo Admin)' })
  async deleteUserById(@Param('id') id: string) {
    const userToDelete = await this.usersService.findById(id);
    await deleteCloudinaryAvatarIfPresent(
      this.cloudinaryService,
      userToDelete?.avatarUrl,
    );
    await this.usersService.remove(id);
    return {
      message: `Usuario con ID ${id} eliminado correctamente del sistema.`,
    };
  }
}
