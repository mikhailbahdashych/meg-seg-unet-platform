import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ModelTemplatesService } from './model-templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { ModelTemplate } from './entities/model-template.entity';

@Controller('model-templates')
export class ModelTemplatesController {
  constructor(private readonly modelTemplatesService: ModelTemplatesService) {}

  @Get()
  async findAll(): Promise<ModelTemplate[]> {
    return this.modelTemplatesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<ModelTemplate> {
    return this.modelTemplatesService.findOne(id);
  }

  @Post()
  async create(
    @Body() createTemplateDto: CreateTemplateDto
  ): Promise<ModelTemplate> {
    return this.modelTemplatesService.create(createTemplateDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() updateData: Partial<CreateTemplateDto>
  ): Promise<ModelTemplate> {
    return this.modelTemplatesService.update(id, updateData);
  }

  @Delete(':id')
  async delete(@Param('id') id: number): Promise<void> {
    await this.modelTemplatesService.delete(id);
  }
}
