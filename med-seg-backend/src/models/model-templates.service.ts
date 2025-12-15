import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelTemplate } from './entities/model-template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class ModelTemplatesService {
  constructor(
    @InjectRepository(ModelTemplate)
    private templatesRepository: Repository<ModelTemplate>
  ) {}

  async findAll(): Promise<ModelTemplate[]> {
    return this.templatesRepository.find({
      order: {
        createdAt: 'DESC'
      }
    });
  }

  async findOne(id: number): Promise<ModelTemplate> {
    const template = await this.templatesRepository.findOne({
      where: { id }
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  async create(createTemplateDto: CreateTemplateDto): Promise<ModelTemplate> {
    const template = this.templatesRepository.create(createTemplateDto);
    return this.templatesRepository.save(template);
  }

  async update(
    id: number,
    updateData: Partial<CreateTemplateDto>
  ): Promise<ModelTemplate> {
    const template = await this.findOne(id);
    Object.assign(template, updateData);
    return this.templatesRepository.save(template);
  }

  async delete(id: number): Promise<void> {
    const template = await this.findOne(id);
    await this.templatesRepository.remove(template);
  }
}
