import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Dataset } from '@datasets/entities/dataset.entity';
import { Model } from './models/entities/model.entity';
import { Credentials } from './settings/entities/credentials.entity';
import { DatasetsModule } from '@datasets/datasets.module';
import { ModelsModule } from './models/models.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'medseg.db',
      entities: [Dataset, Model, Credentials],
      synchronize: true
    }),
    DatasetsModule,
    ModelsModule,
    SettingsModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
