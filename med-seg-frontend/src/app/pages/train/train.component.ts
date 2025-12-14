import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DatasetService } from '@services/dataset.service';
import { ModelService } from '@services/model.service';
import { SettingsService } from '@services/settings.service';
import { TrainingService, GpuType } from '@services/training.service';
import { Dataset } from '@interfaces/dataset.interface';
import { Template } from '@interfaces/template.interface';

@Component({
  selector: 'app-train',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
    private router: Router
  ) {}

  ngOnInit(): void {
    this.checkCredentials();
    this.loadGpuTypes();
    this.loadTemplates();
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
}
