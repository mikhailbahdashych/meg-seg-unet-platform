import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';
import { InferenceService } from './inference.service';
import { Model } from './entities/model.entity';
import { ModelTemplate } from './entities/model-template.entity';
import { Dataset } from '../datasets/entities/dataset.entity';
import { SharedModule } from '../shared/shared.module';
import { ModelTemplatesController } from './model-templates.controller';
import { ModelTemplatesService } from './model-templates.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Model, ModelTemplate, Dataset]),
    SharedModule,
    forwardRef(() =>
      import('../training/training.module').then((m) => m.TrainingModule)
    )
  ],
  controllers: [ModelsController, ModelTemplatesController],
  providers: [ModelsService, ModelTemplatesService, InferenceService],
  exports: [ModelsService, ModelTemplatesService, InferenceService]
})
export class ModelsModule {}
