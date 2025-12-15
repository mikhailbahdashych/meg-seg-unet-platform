# MedSeg ML

Python machine learning module providing U-Net model training and inference capabilities for medical image segmentation.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Usage](#usage)
- [Configuration](#configuration)
- [Dataset Format](#dataset-format)
- [Training](#training)
- [Inference](#inference)
- [Model Architecture](#model-architecture)
- [Loss Functions](#loss-functions)
- [Data Augmentation](#data-augmentation)
- [Output Files](#output-files)
- [Integration with Backend](#integration-with-backend)
- [Troubleshooting](#troubleshooting)

## Overview

MedSeg ML is the machine learning component of the MedSeg platform, responsible for training U-Net models for medical image segmentation and performing inference on medical images. It provides configurable U-Net architectures, multiple loss functions, data augmentation pipelines, and AWS S3 integration for dataset and model storage.

The module is designed to be called by the NestJS backend via Python child processes, with progress tracking through JSON status files.

## Features

- **Configurable U-Net Architecture**: Adjustable depth, filters, input/output channels
- **Multiple Loss Functions**: Dice Loss, Binary Cross-Entropy, Focal Loss, Combined Loss
- **Advanced Data Augmentation**: Comprehensive augmentation pipeline using Albumentations
- **AWS S3 Integration**: Download datasets and upload trained models to S3
- **Progress Tracking**: Real-time training status updates via JSON files
- **Validation Split**: Automatic train/validation split with metrics tracking
- **GPU Support**: Automatic CUDA detection for accelerated training
- **Checkpoint Management**: Save and load model checkpoints
- **Batch Inference**: Process multiple images in batches

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.9+ | Programming language |
| **PyTorch** | 2.x | Deep learning framework |
| **Albumentations** | 1.x | Data augmentation |
| **Pillow** | 10.x | Image processing |
| **NumPy** | 1.x | Numerical operations |
| **Boto3** | 1.x | AWS S3 client |
| **tqdm** | 4.x | Progress bars |
| **Matplotlib** | 3.x | Visualization |
| **scikit-image** | 0.x | Image processing utilities |

## Prerequisites

Before installing, ensure you have:

- **Python**: Version 3.9 or higher
- **pip or uv**: Python package manager
- **CUDA**: Optional but recommended for GPU acceleration
- **AWS Credentials**: For S3 integration (if using cloud storage)

Check your Python version:

```bash
python3 --version
```

Check CUDA availability:

```bash
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
```

## Installation

### Using uv (Recommended)

Install using the uv package manager:

```bash
cd med-seg-ml
uv pip install -e .
```

### Using pip

Install using traditional pip:

```bash
cd med-seg-ml
pip install -r requirements.txt
```

### Manual Installation

Install dependencies individually:

```bash
pip install torch torchvision numpy pillow boto3 albumentations tqdm matplotlib scikit-image
```

## Project Structure

```
med-seg-ml/
|
+-- unet.py                    # Basic U-Net architecture
+-- unet_configurable.py       # Configurable U-Net with variable depth
+-- losses.py                  # Loss functions (Dice, BCE, Focal, Combined)
+-- dataset.py                 # Dataset loader with augmentation pipeline
+-- train.py                   # Training script with S3 integration
+-- infer.py                   # Inference script for segmentation
+-- prepare_montgomery_dataset.py  # Dataset preparation utility
+-- requirements.txt           # pip dependencies
+-- pyproject.toml             # uv project configuration
+-- README.md                  # This file
```

## Usage

### Quick Start

1. Prepare a training configuration JSON file
2. Run the training script
3. Monitor progress via status file
4. Use trained model for inference

## Configuration

### Training Configuration File

Create a JSON configuration file with the following structure:

```json
{
  "dataset_s3_bucket": "med-seg-platform",
  "dataset_s3_key": "datasets/abc-123/",
  "model_s3_bucket": "med-seg-platform",
  "model_s3_key": "models/def-456/model.pth",
  "aws_credentials": {
    "access_key_id": "AKIA...",
    "secret_access_key": "...",
    "region": "eu-central-1"
  },
  "hyperparameters": {
    "input_channels": 3,
    "output_channels": 1,
    "base_filters": 64,
    "depth": 4,
    "epochs": 50,
    "batch_size": 4,
    "learning_rate": 0.001,
    "optimizer": "adam",
    "loss_function": "dice",
    "validation_split": 0.2
  }
}
```

### Hyperparameters Reference

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `input_channels` | int | 3 | 1-4 | Number of input channels (1: grayscale, 3: RGB) |
| `output_channels` | int | 1 | 1-N | Number of output channels (1: binary, N: multi-class) |
| `base_filters` | int | 64 | 32-128 | Filters in first layer (doubles at each depth level) |
| `depth` | int | 4 | 3-5 | Number of encoder/decoder stages |
| `epochs` | int | 50 | 10-200 | Number of training epochs |
| `batch_size` | int | 4 | 1-16 | Training batch size (reduce if OOM) |
| `learning_rate` | float | 0.001 | 0.0001-0.01 | Initial learning rate |
| `optimizer` | string | "adam" | adam, sgd, rmsprop | Optimization algorithm |
| `loss_function` | string | "dice" | dice, bce, focal, combined | Loss function type |
| `validation_split` | float | 0.2 | 0.1-0.3 | Fraction of data for validation |

## Dataset Format

### Directory Structure

Datasets must be organized with matching image-mask pairs:

```
dataset/
|
+-- images/
|   +-- image001.png
|   +-- image002.png
|   +-- image003.png
|   ...
|
+-- masks/
    +-- image001.png
    +-- image002.png
    +-- image003.png
    ...
```

### Requirements

- **Matching Filenames**: Images and masks must have identical filenames
- **Supported Formats**: PNG, JPG, JPEG, TIF, TIFF, BMP
- **Mask Format**: Grayscale images with pixel values 0 (background) or 255 (foreground)
- **Image Size**: Images will be resized to 256x256 during training
- **Consistency**: All images should have the same number of channels

### Dataset Validation

The dataset loader validates:
1. Image and mask files exist and match by filename
2. Images can be loaded without errors
3. Masks are single-channel (grayscale)
4. Image-mask pairs have compatible dimensions

## Training

### Local Training with S3 Dataset

Download dataset from S3 and train:

```bash
python train.py \
  --config config.json \
  --data-dir ./data \
  --download-from-s3
```

### Local Training with Local Dataset

Train using local dataset:

```bash
python train.py \
  --config config.json \
  --data-dir /path/to/dataset
```

### Training Process

The training script performs the following steps:

1. **Initialization**:
   - Load configuration from JSON
   - Set up output directory
   - Initialize status tracking

2. **Dataset Preparation**:
   - Download from S3 (if specified)
   - Validate dataset structure
   - Split into train/validation sets
   - Apply augmentation pipeline

3. **Model Setup**:
   - Create U-Net model based on config
   - Move model to GPU (if available)
   - Initialize optimizer and loss function

4. **Training Loop**:
   - For each epoch:
     - Train on training set
     - Validate on validation set
     - Update status JSON file
     - Save checkpoint (optional)

5. **Finalization**:
   - Save final model
   - Upload to S3 (if configured)
   - Write training history

### Monitoring Training Progress

During training, monitor the `output/training_status.json` file:

```json
{
  "status": "training",
  "current_epoch": 23,
  "total_epochs": 50,
  "progress_percent": 46.0,
  "current_loss": 0.234,
  "current_dice_score": 0.876,
  "best_dice_score": 0.891,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Status values:
- `initializing`: Setting up training environment
- `downloading`: Downloading dataset from S3
- `training`: Active training in progress
- `completed`: Training finished successfully
- `failed`: Training encountered an error

### Training Output

Training produces the following files in the `output/` directory:

- `model.pth`: Final trained model checkpoint
- `training_history.json`: Complete training metrics per epoch
- `training_status.json`: Current training status
- `checkpoint_epoch_X.pth`: Optional intermediate checkpoints

## Inference

### Running Inference

Perform inference on new images:

```bash
python infer.py \
  --model-path output/model.pth \
  --input-dir ./input_images \
  --output-dir ./results
```

### Batch Inference

Process multiple images:

```bash
python infer.py \
  --model-path output/model.pth \
  --input-dir ./batch_images \
  --output-dir ./batch_results \
  --batch-size 8
```

### Inference with S3

Download model from S3 and upload results:

```bash
python infer.py \
  --model-s3-bucket med-seg-platform \
  --model-s3-key models/def-456/model.pth \
  --input-dir ./images \
  --output-s3-bucket med-seg-platform \
  --output-s3-prefix inference-results/
```

### Inference Output

For each input image, inference generates:

1. **Segmentation Mask**: Binary or multi-class prediction
2. **Probability Map**: Raw model output (0.0 to 1.0)
3. **Overlay Image**: Original image with mask overlay (optional)

Output files:
- `input_image_name_mask.png`: Segmentation mask
- `input_image_name_prob.png`: Probability map
- `input_image_name_overlay.png`: Visualization overlay

## Model Architecture

### U-Net Overview

The U-Net architecture consists of:

1. **Encoder Path** (Contracting):
   - Repeated blocks of: Conv -> ReLU -> Conv -> ReLU -> MaxPool
   - Doubles feature channels at each level
   - Reduces spatial dimensions by half

2. **Bottleneck**:
   - Deepest layer with maximum feature channels
   - No pooling or upsampling

3. **Decoder Path** (Expanding):
   - Repeated blocks of: Upsample -> Concatenate -> Conv -> ReLU -> Conv -> ReLU
   - Halves feature channels at each level
   - Doubles spatial dimensions

4. **Skip Connections**:
   - Concatenate encoder features to decoder at each level
   - Preserves spatial information lost during downsampling

### Architecture Parameters

Example configuration for depth=4, base_filters=64:

```
Input: 256x256x3

Encoder:
  Level 1: 256x256x64
  Level 2: 128x128x128
  Level 3: 64x64x256
  Level 4: 32x32x512

Bottleneck: 16x16x1024

Decoder:
  Level 4: 32x32x512
  Level 3: 64x64x256
  Level 2: 128x128x128
  Level 1: 256x256x64

Output: 256x256x1
```

### Model Variants

The module provides two U-Net implementations:

1. **unet.py**: Basic fixed-depth U-Net (depth=4)
2. **unet_configurable.py**: Configurable depth and filters

Use configurable version for flexibility.

## Loss Functions

### Dice Loss

Measures overlap between prediction and ground truth:

```
Dice = (2 * |X ∩ Y|) / (|X| + |Y|)
Dice Loss = 1 - Dice
```

**Best for**: Segmentation tasks with class imbalance
**Range**: 0.0 (perfect) to 1.0 (no overlap)

### Binary Cross-Entropy (BCE)

Standard pixel-wise classification loss:

```
BCE = -[y*log(p) + (1-y)*log(1-p)]
```

**Best for**: Balanced datasets with clear boundaries
**Range**: 0.0 (perfect) to infinity

### Focal Loss

Addresses class imbalance by focusing on hard examples:

```
FL = -alpha * (1-p)^gamma * log(p)
```

**Best for**: Severe class imbalance (small objects)
**Parameters**: alpha=0.25, gamma=2.0

### Combined Loss

Weighted combination of Dice and BCE:

```
Combined = 0.5 * Dice Loss + 0.5 * BCE Loss
```

**Best for**: General-purpose segmentation
**Advantages**: Combines benefits of both losses

## Data Augmentation

### Training Augmentations

Applied to training set with specified probabilities:

| Augmentation | Probability | Parameters |
|--------------|-------------|------------|
| Horizontal Flip | 50% | - |
| Vertical Flip | 50% | - |
| Rotate 90 degrees | 50% | 0, 90, 180, 270 degrees |
| Shift/Scale/Rotate | 50% | shift: 0.1, scale: 0.1, rotate: 15 degrees |
| Gaussian Blur | 30% | blur limit: 3-7 |
| Median Blur | 30% | blur limit: 3-7 |
| Brightness/Contrast | 30% | brightness: 0.2, contrast: 0.2 |
| Gaussian Noise | 20% | variance: 0.01 |

### Validation Augmentations

Validation set uses no augmentation to ensure consistent metrics:
- Resize to 256x256
- Normalize to [0, 1]

### Custom Augmentation Pipeline

Modify `dataset.py` to customize augmentations:

```python
self.transform = A.Compose([
    A.HorizontalFlip(p=0.5),
    A.VerticalFlip(p=0.5),
    A.RandomRotate90(p=0.5),
    # Add custom augmentations here
    A.Resize(256, 256),
    A.Normalize(mean=[0.0], std=[1.0])
])
```

## Output Files

### Model Checkpoint Format

Saved models contain complete training information:

```python
{
    'model_state_dict': state_dict,     # PyTorch model weights
    'model_config': {                   # Architecture configuration
        'in_channels': 3,
        'out_channels': 1,
        'base_filters': 64,
        'depth': 4
    },
    'hyperparameters': {                # Training hyperparameters
        'epochs': 50,
        'batch_size': 4,
        'learning_rate': 0.001,
        'optimizer': 'adam',
        'loss_function': 'dice'
    },
    'training_history': [               # Metrics per epoch
        {
            'epoch': 1,
            'train_loss': 0.456,
            'val_loss': 0.423,
            'val_dice': 0.789
        },
        ...
    ],
    'best_metrics': {                   # Best achieved metrics
        'best_dice_score': 0.912,
        'best_epoch': 45
    }
}
```

### Loading a Trained Model

Load and use a trained model:

```python
import torch
from unet_configurable import UNetConfigurable

# Load checkpoint
checkpoint = torch.load('output/model.pth')

# Recreate model
model = UNetConfigurable(**checkpoint['model_config'])
model.load_state_dict(checkpoint['model_state_dict'])
model.eval()

# Use for inference
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model.to(device)

with torch.no_grad():
    input_tensor = torch.randn(1, 3, 256, 256).to(device)
    output = model(input_tensor)
    prediction = torch.sigmoid(output) > 0.5
```

### Training History Format

Complete training metrics saved as JSON:

```json
{
  "epochs": 50,
  "history": [
    {
      "epoch": 1,
      "train_loss": 0.456,
      "train_dice": 0.678,
      "val_loss": 0.423,
      "val_dice": 0.789,
      "learning_rate": 0.001,
      "timestamp": "2024-01-15T10:00:00Z"
    },
    ...
  ],
  "best_metrics": {
    "best_dice_score": 0.912,
    "best_epoch": 45,
    "final_train_loss": 0.123,
    "final_val_loss": 0.145
  }
}
```

## Integration with Backend

### Backend Integration Flow

The NestJS backend integrates with ML scripts as follows:

1. **Training Request**:
   - Backend receives training request from frontend
   - Generates configuration JSON file
   - Spawns Python training process: `python train.py --config config.json`
   - Monitors `training_status.json` for progress updates
   - Returns status updates to frontend via polling

2. **Progress Monitoring**:
   - Backend polls `training_status.json` every 5 seconds
   - Extracts current epoch, loss, and metrics
   - Provides progress percentage to frontend

3. **Model Storage**:
   - Training script uploads model to S3 on completion
   - Backend updates database with model metadata
   - Frontend notified of completion

4. **Inference Request**:
   - Backend spawns inference process: `python infer.py --model-path ...`
   - Collects segmentation results
   - Returns results to frontend

### Expected Output Format

Training status updates must follow this format for backend compatibility:

```json
{
  "status": "training",
  "current_epoch": 23,
  "total_epochs": 50,
  "progress_percent": 46.0,
  "current_loss": 0.234,
  "current_dice_score": 0.876,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Troubleshooting

### Out of Memory Errors

**Symptoms**: CUDA out of memory or system memory exhausted

**Solutions**:
```bash
# Reduce batch size
"batch_size": 2  # or 1 for very limited memory

# Reduce model size
"base_filters": 32  # instead of 64

# Reduce image size in dataset.py
A.Resize(128, 128)  # instead of 256x256
```

### Training Too Slow

**Symptoms**: Training takes too long per epoch

**Solutions**:
```bash
# Increase batch size (if GPU memory allows)
"batch_size": 8

# Reduce augmentation probability
A.HorizontalFlip(p=0.3)  # instead of 0.5

# Use fewer workers in DataLoader
num_workers=2  # instead of 4
```

### Poor Validation Performance

**Symptoms**: High validation loss or low Dice score

**Solutions**:
```bash
# Increase training epochs
"epochs": 100

# Try combined loss function
"loss_function": "combined"

# Adjust learning rate
"learning_rate": 0.0001  # or 0.01

# Verify dataset quality
# - Check mask alignment with images
# - Ensure consistent annotation quality
# - Balance dataset size (aim for 100+ samples)
```

### CUDA Not Available

**Symptoms**: Training uses CPU instead of GPU

**Solutions**:
```bash
# Check PyTorch CUDA installation
python3 -c "import torch; print(torch.cuda.is_available())"

# Reinstall PyTorch with CUDA support
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# Verify CUDA drivers
nvidia-smi
```

### S3 Upload Failures

**Symptoms**: Model upload to S3 fails

**Solutions**:
```bash
# Verify AWS credentials
aws s3 ls s3://your-bucket-name

# Check IAM permissions
# Ensure credentials have s3:PutObject permission

# Verify bucket exists
aws s3 mb s3://your-bucket-name

# Test boto3 connection
python3 -c "import boto3; s3 = boto3.client('s3'); print(s3.list_buckets())"
```

### Image Format Errors

**Symptoms**: Dataset loader fails to read images

**Solutions**:
```bash
# Verify image formats
file images/*.png

# Convert images to supported format
for img in *.jpg; do convert "$img" "${img%.jpg}.png"; done

# Check for corrupted images
from PIL import Image
for path in image_paths:
    try:
        Image.open(path)
    except Exception as e:
        print(f"Corrupted: {path}")
```

