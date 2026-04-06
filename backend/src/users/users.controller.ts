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
import { User } from './schemas/user.schema';
import { Action } from 'src/casl/enums/action.enum';
// Estructura mínima esperada del archivo de avatar.
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
   * Devuelve perfil del usuario autenticado.
   */
  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil logueado' })
  async getProfile(@Request() req: ValidatedRequest) {
    return this.usersService.findOne(req.user.sub);
  }

  /**
   * Elimina cuenta propia y limpia avatar remoto (Cloudinary) si existe.
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
   * Actualiza perfil propio y, opcionalmente, reemplaza avatar.
   * Si sube nuevo avatar, elimina el anterior para no dejar basura en Cloudinary.
   */
  @Patch('me')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máx.
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(
            new BadRequestException(
              'Solo se permiten archivos de imagen para el avatar.',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
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

  /**
   * Buscar usuarios por nombre o email (invitaciones a tableros). Mínimo 2 caracteres.
   */
  @Get('search')
  @ApiOperation({ summary: 'Buscar usuarios para invitar (autenticado)' })
  async searchUsers(@Query('q') q: string, @Request() req: ValidatedRequest) {
    return this.usersService.searchForInvite(q ?? '', req.user.sub);
  }

  /**
   * Listado global de usuarios (solo admin app).
   */
  @Get()
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, User))
  @ApiOperation({ summary: 'Obtener todos los usuarios (Solo Admin)' })
  async findAllUsers() {
    return this.usersService.findAll();
  }

  /**
   * Edición de cualquier usuario por id (solo admin app).
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, User))
  @ApiOperation({ summary: 'Editar cualquier usuario (Solo Admin)' })
  async updateUserById(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  /**
   * Borrado de cualquier usuario (solo admin app) + limpieza de avatar.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, User))
  @ApiOperation({ summary: 'Eliminar cualquier usuario (Solo Admin)' })
  async deleteUserById(@Param('id') id: string) {
    const userToDelete = await this.usersService.findById(id);

    if (userToDelete && userToDelete.avatarUrl) {
      const publicId = this.cloudinaryService.extractPublicId(
        userToDelete.avatarUrl,
      );
      if (publicId) {
        await this.cloudinaryService.deleteFile(publicId);
      }
    }

    await this.usersService.remove(id);
    return {
      message: `Usuario con ID ${id} eliminado correctamente del sistema.`,
    };
  }
}
