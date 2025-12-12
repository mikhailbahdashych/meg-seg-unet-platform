import { Routes } from '@angular/router';
import { LayoutComponent } from '@components/layout/layout.component';
import { HomeComponent } from './pages/home/home.component';
import { UploadComponent } from './pages/upload/upload.component';
import { TrainComponent } from './pages/train/train.component';
import { ModelsComponent } from './pages/models/models.component';
import { ModelDetailsComponent } from './pages/model-details/model-details.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: '',
        component: HomeComponent
      },
      {
        path: 'upload',
        component: UploadComponent
      },
      {
        path: 'train',
        component: TrainComponent
      },
      {
        path: 'models',
        component: ModelsComponent
      },
      {
        path: 'models/:id',
        component: ModelDetailsComponent
      }
    ]
  }
];
