import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DatasetService } from '@services/dataset.service';
import { ModelService } from '@services/model.service';
import { Dataset } from '@interfaces/dataset.interface';

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

  // U-Net Architecture
  architecture = {
    inputChannels: 3,
    outputChannels: 1,
    baseFilters: 64,
    depth: 4
  };

  // Training Hyperparameters
  training = {
    epochs: 50,
    batchSize: 4,
    learningRate: 0.001,
    optimizer: 'adam' as 'adam' | 'sgd' | 'rmsprop',
    lossFunction: 'dice' as 'dice' | 'bce' | 'focal' | 'combined',
    validationSplit: 0.2
  };

  constructor(
    private datasetService: DatasetService,
    private modelService: ModelService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDatasets();
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

  canStartTraining(): boolean {
    return (
      this.selectedDatasetId !== null &&
      this.modelName.trim().length > 0 &&
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
      inputChannels: this.architecture.inputChannels,
      outputChannels: this.architecture.outputChannels,
      baseFilters: this.architecture.baseFilters,
      depth: this.architecture.depth,
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
