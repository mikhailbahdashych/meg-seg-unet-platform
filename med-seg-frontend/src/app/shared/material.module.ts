import { NgModule } from '@angular/core';

// Material Components
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatBadgeModule } from '@angular/material/badge';
import { MatCardModule } from '@angular/material/card';

const MATERIAL_MODULES = [
  MatButtonModule,
  MatIconModule,
  MatDialogModule,
  MatTableModule,
  MatSortModule,
  MatPaginatorModule,
  MatProgressBarModule,
  MatProgressSpinnerModule,
  MatChipsModule,
  MatTooltipModule,
  MatMenuModule,
  MatCheckboxModule,
  MatRadioModule,
  MatSelectModule,
  MatInputModule,
  MatFormFieldModule,
  MatSlideToggleModule,
  MatSliderModule,
  MatSnackBarModule,
  MatTabsModule,
  MatExpansionModule,
  MatBadgeModule,
  MatCardModule
];

@NgModule({
  imports: MATERIAL_MODULES,
  exports: MATERIAL_MODULES
})
export class MaterialModule {}
