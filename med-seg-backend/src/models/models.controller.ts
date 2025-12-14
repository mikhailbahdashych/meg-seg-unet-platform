import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ModelsService } from './models.service';
import { TrainModelDto } from './dto/train-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { Model } from './entities/model.entity';

@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

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
