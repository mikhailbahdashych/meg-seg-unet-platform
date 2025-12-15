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
  BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { ModelsService } from './models.service';
import { InferenceService } from './inference.service';
import { TrainModelDto } from './dto/train-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { InferenceResultDto } from './dto/inference-result.dto';
import { Model } from './entities/model.entity';

@Controller('models')
export class ModelsController {
  constructor(
    private readonly modelsService: ModelsService,
    private readonly inferenceService: InferenceService
  ) {}

  @Get()
  async findAll(): Promise<Model[]> {
    return this.modelsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Model> {
    return this.modelsService.findOne(id);
  }

  @Get('dataset/:datasetId')
  async findByDataset(@Param('datasetId') datasetId: number): Promise<Model[]> {
    return this.modelsService.findByDataset(datasetId);
  }

  @Post('train')
  async trainModel(@Body() trainModelDto: TrainModelDto): Promise<Model> {
    return this.modelsService.createTrainingJob(trainModelDto);
  }

  @Get(':id/status')
  async getTrainingStatus(@Param('id') id: number): Promise<any> {
    return this.modelsService.getTrainingStatus(id);
  }

  @Get(':id/download')
  async getDownloadUrl(@Param('id') id: number): Promise<{ url: string }> {
    const url = await this.modelsService.getDownloadUrl(id);
    return { url };
  }

  @Get(':id/training-history')
  async getTrainingHistory(@Param('id') id: number): Promise<any> {
    return this.modelsService.getTrainingHistory(id);
  }

  @Post(':id/infer')
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
          cb(null, `inference-${uniqueSuffix}${path.extname(file.originalname)}`);
        }
      }),
      fileFilter: (req, file, cb) => {
        // Allow common image formats
        const allowedMimes = [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/bmp',
          'image/tiff'
        ];
        const allowedExts = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff'];
        const ext = path.extname(file.originalname).toLowerCase();

        if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Invalid file type. Only PNG, JPG, JPEG, BMP, and TIFF images are allowed.'
            ),
            false
          );
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
      }
    })
  )
  async runInference(
    @Param('id') id: number,
    @UploadedFile() file: Express.Multer.File
  ): Promise<InferenceResultDto> {
    if (!file) {
      throw new BadRequestException('No image file uploaded');
    }

    return this.inferenceService.runInference(id, file);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() updateModelDto: UpdateModelDto
  ): Promise<Model> {
    return this.modelsService.update(id, updateModelDto);
  }

  @Post(':id/cancel')
  async cancelTraining(@Param('id') id: number): Promise<Model> {
    return this.modelsService.cancelTraining(id);
  }

  @Delete(':id')
  async delete(@Param('id') id: number): Promise<void> {
    await this.modelsService.delete(id);
  }

  @Post('bulk-delete')
  async bulkDelete(
    @Body() body: { ids: number[] }
  ): Promise<{ deleted: number; failed: number[] }> {
    return this.modelsService.bulkDelete(body.ids);
  }
}
