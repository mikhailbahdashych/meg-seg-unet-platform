# MedSeg ML - U-Net Medical Image Segmentation

Python training scripts for U-Net medical image segmentation models.

## Features

- **U-Net Architecture**: Configurable depth, filters, input/output channels
- **Multiple Loss Functions**: Dice, BCE, Focal, Combined (Dice + BCE)
- **Data Augmentation**: Flips, rotations, brightness/contrast adjustments
- **S3 Integration**: Download datasets and upload trained models to AWS S3
- **Progress Tracking**: Real-time status updates via JSON file
- **Validation**: Automatic train/validation split with metrics tracking

## Installation

Using UV:

```bash
cd med-seg-ml
uv pip install -e .
```

Or install dependencies directly:

```bash
uv pip install torch torchvision numpy pillow boto3 albumentations tqdm matplotlib scikit-image
```

## Project Structure

```
med-seg-ml/
├── unet.py              # U-Net model architecture
├── losses.py            # Loss functions (Dice, BCE, Focal, Combined)
├── dataset.py           # Dataset loader with augmentation
├── train.py             # Main training script
├── requirements.txt     # pip dependencies
├── pyproject.toml       # UV project configuration
└── example_config.json  # Example training configuration
```

## Usage

### 1. Prepare Training Configuration

Create a JSON config file (see `example_config.json`):

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

### 2. Run Training

**With S3 download:**
```bash
python train.py --config config.json --data-dir ./data --download-from-s3
```

**With local data:**
```bash
python train.py --config config.json --data-dir /path/to/local/data
```

### 3. Monitor Progress

During training, check `output/training_status.json`:

```json
{
  "status": "training",
  "current_epoch": 23,
  "total_epochs": 50,
  "progress_percent": 46,
  "current_loss": 0.234,
  "current_dice_score": 0.876,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Configuration Options

### Hyperparameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `input_channels` | int | 3 | Number of input channels (3 for RGB, 1 for grayscale) |
| `output_channels` | int | 1 | Number of output channels (1 for binary segmentation) |
| `base_filters` | int | 64 | Number of filters in first layer (32, 64, 128) |
| `depth` | int | 4 | Number of encoder/decoder stages (3, 4, 5) |
| `epochs` | int | 50 | Number of training epochs |
| `batch_size` | int | 4 | Batch size (2, 4, 8, 16) |
| `learning_rate` | float | 0.001 | Learning rate |
| `optimizer` | string | "adam" | Optimizer: "adam", "sgd", "rmsprop" |
| `loss_function` | string | "dice" | Loss: "dice", "bce", "focal", "combined" |
| `validation_split` | float | 0.2 | Fraction of data for validation (0.1-0.3) |

## Dataset Format

Your dataset should be organized as:

```
data/
├── images/
│   ├── image001.png
│   ├── image002.png
│   └── ...
└── masks/
    ├── image001.png
    ├── image002.png
    └── ...
```

**Requirements:**
- Images and masks must have matching filenames
- Supported formats: PNG, JPG, JPEG, TIF, TIFF, BMP
- Masks should be grayscale (0-255 or 0-1)
- Images will be resized to 256x256 during training

## Output Files

After training, the following files are generated in `output/`:

- `model.pth` - Final trained model checkpoint
- `training_history.json` - Complete training metrics
- `training_status.json` - Current training status
- `checkpoint_epoch_X.pth` - Optional epoch checkpoints

## Model Checkpoint Format

The saved model contains:

```python
{
    'model_state_dict': ...,        # PyTorch model weights
    'model_config': {               # U-Net architecture config
        'in_channels': 3,
        'out_channels': 1,
        'base_filters': 64,
        'depth': 4
    },
    'hyperparameters': {...},       # Training hyperparameters
    'training_history': [...]       # Metrics per epoch
}
```

## Loading a Trained Model

```python
import torch
from unet import create_unet

# Load checkpoint
checkpoint = torch.load('output/model.pth')

# Recreate model
model = create_unet(**checkpoint['model_config'])
model.load_state_dict(checkpoint['model_state_dict'])
model.eval()

# Use for inference
with torch.no_grad():
    output = model(input_image)
```

## Loss Functions

### Dice Loss
Best for segmentation tasks. Measures overlap between prediction and ground truth.

### BCE (Binary Cross-Entropy)
Standard classification loss. Works well for balanced datasets.

### Focal Loss
Handles class imbalance by focusing on hard examples.

### Combined Loss
Weighted combination of Dice + BCE for better convergence.

## Data Augmentation

Training uses the following augmentations (validation uses none):

- Horizontal/Vertical flips (50% probability)
- Random 90° rotations (50% probability)
- Shift/Scale/Rotate (50% probability)
- Gaussian/Median blur (30% probability)
- Brightness/Contrast adjustments (30% probability)

## GPU Support

The training script automatically uses CUDA if available:

```
Using device: cuda
```

For CPU-only training:
```
Using device: cpu
```

## Troubleshooting

**Out of Memory:**
- Reduce `batch_size` to 2 or 1
- Reduce image size in `dataset.py`
- Use fewer `base_filters` (32 instead of 64)

**Training too slow:**
- Increase `batch_size` if GPU memory allows
- Reduce data augmentation probability
- Use fewer `num_workers` in dataloaders

**Poor validation performance:**
- Increase `epochs`
- Try different `loss_function` (combined often works well)
- Adjust `learning_rate` (try 0.0001 or 0.01)
- Check data quality and mask alignment

## Integration with Backend

The backend will:
1. Generate a config JSON file
2. Upload it to the training environment (local/RunPod)
3. Execute: `python train.py --config config.json --download-from-s3`
4. Poll `training_status.json` for progress
5. Retrieve final model from S3

## License

Part of the MedSeg Platform - Academic project for neural network architectures course.
