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

  @Get('me')
  @ApiOperation({ summary: 'Obtener mi perfil' })
  async getProfile(@Request() req: ValidatedRequest) {
    return this.usersService.findById(req.user.sub);
  }

  @Patch('me')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar mi perfil' })
  @ApiBody({
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
