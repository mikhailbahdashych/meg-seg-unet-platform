import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { DatasetsService } from '@datasets/datasets.service';
import { CreateDatasetDto } from '@datasets/dto/create-dataset.dto';
import { UpdateDatasetDto } from '@datasets/dto/update-dataset.dto';
import { Dataset } from '@datasets/entities/dataset.entity';
import * as path from 'path';
import * as fs from 'fs';

@Controller('datasets')
export class DatasetsController {
  constructor(private readonly datasetsService: DatasetsService) {}

  @Get()
  async findAll(): Promise<Dataset[]> {
    return this.datasetsService.findAll();
  }

  @Post()
  async create(@Body() createDatasetDto: CreateDatasetDto): Promise<Dataset> {
    return this.datasetsService.create(createDatasetDto);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(process.cwd(), 'temp', 'uploads');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `dataset-${uniqueSuffix}.zip`);
        }
      }),
      limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit
        files: 1
      },
      fileFilter: (req, file, cb) => {
        if (
          file.mimetype === 'application/zip' ||
          file.originalname.endsWith('.zip')
        ) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only ZIP files are allowed'), false);
        }
      }
    })
  )
  async uploadDataset(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string
  ): Promise<Dataset> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!name || name.trim().length === 0) {
      throw new BadRequestException('Dataset name is required');
    }

    return this.datasetsService.uploadDataset(file, name);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() updateDatasetDto: UpdateDatasetDto
  ): Promise<Dataset> {
    try {
      if (updateDatasetDto.name) {
        return await this.datasetsService.updateName(id, updateDatasetDto.name);
      }
      throw new BadRequestException('No update data provided');
    } catch (error) {
      if (error.message === 'Dataset not found') {
        throw new NotFoundException(`Dataset with ID ${id} not found`);
      }
      throw error;
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: number): Promise<void> {
    try {
      await this.datasetsService.delete(id);
    } catch (error) {
      if (error.message === 'Dataset not found') {
        throw new NotFoundException(`Dataset with ID ${id} not found`);
      }
      throw error;
    }
  }
}
