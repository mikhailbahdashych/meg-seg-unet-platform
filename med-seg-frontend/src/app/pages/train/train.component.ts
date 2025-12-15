import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSliderModule } from '@angular/material/slider';
import { DatasetService } from '@services/dataset.service';
import { ModelService } from '@services/model.service';
import { SettingsService } from '@services/settings.service';
import { TrainingService, GpuType } from '@services/training.service';
import { ModelTemplateService } from '@services/model-template.service';
import { NotificationService } from '@shared/services/notification.service';
import { Dataset } from '@interfaces/dataset.interface';
import { Template } from '@interfaces/template.interface';
import { ModelTemplate } from '@interfaces/model-template.interface';
import { SaveTemplateModalComponent } from '../../components/save-template-modal/save-template-modal.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { CardComponent } from '@shared/components/card/card.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-train',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    MatTooltipModule,
    MatExpansionModule,
    MatSliderModule,
    SaveTemplateModalComponent,
    ButtonComponent,
    CardComponent,
    BadgeComponent,
    EmptyStateComponent,
    SkeletonComponent
  ],
  templateUrl: './train.component.html',
  styleUrls: ['./train.component.scss']
})
export class TrainComponent implements OnInit {
  datasets: Dataset[] = [];
  selectedDatasetId: number | null = null;
  modelName = '';
  isSubmitting = false;
  errorMessage = '';

  // Credentials check
  runpodConfigured = false;
  checkingCredentials = true;

  // GPU Selection
  gpuTypes: GpuType[] = [];
  selectedGpuType: string = '';
  loadingGpuTypes = false;

  // Template Selection
  templates: Template[] = [];
  selectedTemplate: Template | null = null;
  loadingTemplates = false;

  // Template Filters
  templateFilters = {
    includeRunpodTemplates: true,
    includePublicTemplates: false,
    includeEndpointBoundTemplates: false
  };

  // Model Templates
  modelTemplates: ModelTemplate[] = [];
  selectedModelTemplate: ModelTemplate | null = null;
  loadingModelTemplates = false;
  showSaveTemplateDialog = false;
  newTemplateName = '';
  newTemplateDescription = '';
  savingTemplate = false;

  showAdvancedArchitecture = false;

  // U-Net Architecture - Basic (Optimized for demo: fast training ~5-10 min)
  architecture = {
    inputChannels: 1, // Grayscale (Chest X-Rays)
    outputChannels: 1,
    baseFilters: 32, // Smaller model = faster training
    depth: 3 // Fewer layers = faster training
  };

  // U-Net Architecture - Advanced
  advancedArchitecture = {
    kernelSize: 3,
    numConvsPerBlock: 2,
    poolingType: 'max' as 'max' | 'avg' | 'strided_conv',
    poolingSize: 2,
    upsamplingType: 'transpose' as 'transpose' | 'bilinear' | 'nearest',
    upsamplingSize: 2,
    useBatchNorm: true,
    activation: 'relu' as 'relu' | 'leaky_relu' | 'elu' | 'selu',
    dropoutRate: 0.0,
    skipConnections: true,
    filterMultiplier: 2
  };

  // Training Hyperparameters (Optimized for demo: fast training)
  training = {
    epochs: 20, // Faster convergence on small dataset
    batchSize: 8, // Better GPU utilization
    learningRate: 0.001,
    optimizer: 'adam' as 'adam' | 'sgd' | 'rmsprop',
    lossFunction: 'dice' as 'dice' | 'bce' | 'focal' | 'combined',
    validationSplit: 0.2
  };

  constructor(
    private datasetService: DatasetService,
    private modelService: ModelService,
    private settingsService: SettingsService,
    private trainingService: TrainingService,
    private modelTemplateService: ModelTemplateService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.checkCredentials();
    this.loadGpuTypes();
    this.loadTemplates();
    this.loadModelTemplates();
  }

  checkCredentials(): void {
    this.checkingCredentials = true;
    this.settingsService.getCredentialsStatus().subscribe({
      next: (status) => {
        this.runpodConfigured = status.runpodConfigured;
        this.checkingCredentials = false;

        if (this.runpodConfigured) {
          this.loadDatasets();
        }
      },
      error: (error) => {
        console.error('Error checking credentials:', error);
        this.checkingCredentials = false;
        this.runpodConfigured = false;
      }
    });
  }

  loadDatasets(): void {
    this.datasetService.getAllDatasets().subscribe({
      next: (datasets) => {
        this.datasets = datasets.filter((d) => d.status === 'ready');
      },
      error: (error) => {
        console.error('Error loading datasets:', error);
        this.errorMessage = 'Failed to load datasets';
      }
    });
  }

  loadGpuTypes(): void {
    this.loadingGpuTypes = true;
    this.trainingService.getAvailableGpuTypes().subscribe({
      next: (types) => {
        this.gpuTypes = types;
        // Pre-select recommended GPU
        const recommended = types.find((t) => t.recommended);
        if (recommended) {
          this.selectedGpuType = recommended.id;
        }
        this.loadingGpuTypes = false;
      },
      error: (error) => {
        console.error('Error loading GPU types:', error);
        this.loadingGpuTypes = false;
      }
    });
  }

  loadTemplates(): void {
    this.loadingTemplates = true;
    this.trainingService
      .getTemplates(
        this.templateFilters.includeRunpodTemplates,
        this.templateFilters.includePublicTemplates,
        this.templateFilters.includeEndpointBoundTemplates
      )
      .subscribe({
        next: (templates) => {
          this.templates = templates;
          // Pre-select first template if available
          if (templates.length > 0) {
            this.selectedTemplate = templates[0];
          }
          this.loadingTemplates = false;
        },
        error: (error) => {
          console.error('Error loading templates:', error);
          this.loadingTemplates = false;
        }
      });
  }

  onTemplateFilterChange(): void {
    this.loadTemplates();
  }

  compareTemplates(t1: Template | null, t2: Template | null): boolean {
    return t1?.id === t2?.id;
  }

  canStartTraining(): boolean {
    return (
      this.selectedDatasetId !== null &&
      this.modelName.trim().length > 0 &&
      this.selectedGpuType !== '' &&
      !this.isSubmitting
    );
  }

  startTraining(): void {
    if (!this.canStartTraining()) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const payload = {
      name: this.modelName.trim(),
      datasetId: this.selectedDatasetId,
      gpuTypeId: this.selectedGpuType,
      // Template selection
      templateImageName: this.selectedTemplate?.imageName,
      // Basic architecture
      inputChannels: this.architecture.inputChannels,
      outputChannels: this.architecture.outputChannels,
      baseFilters: this.architecture.baseFilters,
      depth: this.architecture.depth,
      // Advanced architecture
      kernelSize: this.advancedArchitecture.kernelSize,
      numConvsPerBlock: this.advancedArchitecture.numConvsPerBlock,
      poolingType: this.advancedArchitecture.poolingType,
      poolingSize: this.advancedArchitecture.poolingSize,
      upsamplingType: this.advancedArchitecture.upsamplingType,
      upsamplingSize: this.advancedArchitecture.upsamplingSize,
      useBatchNorm: this.advancedArchitecture.useBatchNorm,
      activation: this.advancedArchitecture.activation,
      dropoutRate: this.advancedArchitecture.dropoutRate,
      skipConnections: this.advancedArchitecture.skipConnections,
      filterMultiplier: this.advancedArchitecture.filterMultiplier,
      // Training hyperparameters
      epochs: this.training.epochs,
      batchSize: this.training.batchSize,
      learningRate: this.training.learningRate,
      optimizer: this.training.optimizer,
      lossFunction: this.training.lossFunction,
      validationSplit: this.training.validationSplit
    };

    this.modelService.trainModel(payload).subscribe({
      next: (model) => {
        console.log('Training job created:', model);
        this.router.navigate(['/models', model.id]);
      },
      error: (error) => {
        console.error('Error starting training:', error);
        this.errorMessage = error.error?.message || 'Failed to start training';
        this.isSubmitting = false;
      }
    });
  }

  getSelectedDatasetName(): string {
    const dataset = this.datasets.find((d) => d.id === this.selectedDatasetId);
    return dataset ? dataset.name : 'None selected';
  }

  loadModelTemplates(): void {
    this.loadingModelTemplates = true;
    this.modelTemplateService.getAllTemplates().subscribe({
      next: (templates) => {
        this.modelTemplates = templates;
        this.loadingModelTemplates = false;
      },
      error: (error) => {
        console.error('Error loading model templates:', error);
        this.loadingModelTemplates = false;
      }
    });
  }

  onModelTemplateChange(): void {
    if (this.selectedModelTemplate) {
      this.applyModelTemplate(this.selectedModelTemplate);
    }
  }

  applyModelTemplate(template: ModelTemplate): void {
    // Apply architecture settings
    this.architecture = {
      inputChannels: template.inputChannels,
      outputChannels: template.outputChannels,
      baseFilters: template.baseFilters,
      depth: template.depth
    };

    // Apply advanced architecture settings
    this.advancedArchitecture = {
      kernelSize: template.kernelSize,
      numConvsPerBlock: template.numConvsPerBlock,
      poolingType: template.poolingType,
      poolingSize: template.poolingSize,
      upsamplingType: template.upsamplingType,
      upsamplingSize: template.upsamplingSize,
      useBatchNorm: template.useBatchNorm,
      activation: template.activation,
      dropoutRate: template.dropoutRate,
      skipConnections: template.skipConnections,
      filterMultiplier: template.filterMultiplier
    };

    // Apply training hyperparameters
    this.training = {
      epochs: template.epochs,
      batchSize: template.batchSize,
      learningRate: template.learningRate,
      optimizer: template.optimizer,
      lossFunction: template.lossFunction,
      validationSplit: template.validationSplit
    };
  }

  openSaveTemplateDialog(): void {
    this.showSaveTemplateDialog = true;
    this.newTemplateName = '';
    this.newTemplateDescription = '';
  }

  closeSaveTemplateDialog(): void {
    this.showSaveTemplateDialog = false;
  }

  saveAsTemplate(data: { name: string; description: string }): void {
    this.savingTemplate = true;

    const templateData = {
      name: data.name,
      description: data.description || undefined,
      ...this.architecture,
      ...this.advancedArchitecture,
      ...this.training
    };

    this.modelTemplateService.createTemplate(templateData).subscribe({
      next: (template) => {
        console.log('Template saved:', template);
        this.savingTemplate = false;
        this.closeSaveTemplateDialog();
        this.loadModelTemplates();
        alert(`Template "${template.name}" saved successfully!`);
      },
      error: (error) => {
        console.error('Error saving template:', error);
        this.savingTemplate = false;
        alert('Failed to save template');
      }
    });
  }
}
