#!/usr/bin/env python3
"""
Inference script for U-Net medical image segmentation.

Loads a trained model and performs inference on a single image,
generating segmentation mask and confidence heatmap.
"""

import argparse
import json
import os
import sys
from pathlib import Path

import torch
import torch.nn as nn
import numpy as np
from PIL import Image
import albumentations as A
from albumentations.pytorch import ToTensorV2
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.cm as cm


def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description='Run inference on medical image using trained U-Net model'
    )
    parser.add_argument(
        '--model-path',
        type=str,
        required=True,
        help='Path to trained model .pth file'
    )
    parser.add_argument(
        '--image-path',
        type=str,
        required=True,
        help='Path to input image'
    )
    parser.add_argument(
        '--output-dir',
        type=str,
        required=True,
        help='Directory to save output files'
    )
    parser.add_argument(
        '--config-json',
        type=str,
        required=True,
        help='JSON string with model architecture configuration'
    )

    return parser.parse_args()


def load_model(model_path, config):
    """
    Load trained U-Net model from checkpoint.

    Args:
        model_path: Path to .pth file
        config: Dictionary with model architecture parameters

    Returns:
        Loaded model in eval mode
    """
    from unet_configurable import ConfigurableUNet

    # Create model with same architecture as training
    model = ConfigurableUNet(
        in_channels=config['input_channels'],
        out_channels=config['output_channels'],
        base_filters=config['base_filters'],
        depth=config['depth'],
        kernel_size=config['kernel_size'],
        num_convs_per_block=config['num_convs_per_block'],
        pooling_type=config['pooling_type'],
        pooling_size=config['pooling_size'],
        upsampling_type=config['upsampling_type'],
        upsampling_size=config['upsampling_size'],
        use_batch_norm=config['use_batch_norm'],
        activation=config['activation'],
        dropout_rate=config['dropout_rate'],
        skip_connections=config['skip_connections'],
        filter_multiplier=config['filter_multiplier']
    )

    # Load trained weights (CPU mode for backend server)
    checkpoint = torch.load(model_path, map_location='cpu')

    # Handle different checkpoint formats
    if 'model_state_dict' in checkpoint:
        model.load_state_dict(checkpoint['model_state_dict'])
    else:
        model.load_state_dict(checkpoint)

    # Set to evaluation mode
    model.eval()

    return model


def preprocess_image(image_path, input_channels, target_size=256):
    """
    Load and preprocess image for inference.

    Args:
        image_path: Path to input image
        input_channels: Number of channels (1 for grayscale, 3 for RGB)
        target_size: Size to resize image to (default 256)

    Returns:
        Tuple of (preprocessed_tensor, original_image, original_size)
    """
    # Load image
    image = Image.open(image_path)
    original_size = image.size  # (width, height)

    # Convert to appropriate color mode
    if input_channels == 1:
        image = image.convert('L')  # Grayscale
    else:
        image = image.convert('RGB')

    # Convert to numpy array
    image_np = np.array(image)

    # Handle grayscale images (add channel dimension if needed)
    if input_channels == 1 and len(image_np.shape) == 2:
        image_np = image_np[:, :, np.newaxis]

    # Apply same preprocessing as training (NO augmentation)
    if input_channels == 1:
        transform = A.Compose([
            A.Resize(height=target_size, width=target_size),
            A.Normalize(mean=[0.485], std=[0.229]),  # Grayscale normalization
            ToTensorV2()
        ])
    else:
        transform = A.Compose([
            A.Resize(height=target_size, width=target_size),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),  # ImageNet normalization
            ToTensorV2()
        ])

    # Apply transformations
    transformed = transform(image=image_np)
    image_tensor = transformed['image'].unsqueeze(0)  # Add batch dimension: (1, C, H, W)

    return image_tensor, image, original_size


def run_inference(model, image_tensor):
    """
    Run inference on preprocessed image.

    Args:
        model: Loaded U-Net model
        image_tensor: Preprocessed image tensor

    Returns:
        Tuple of (binary_mask, confidence_map)
    """
    with torch.no_grad():
        # Forward pass
        output_logits = model(image_tensor)  # Shape: (1, out_channels, H, W)

        # Apply sigmoid for binary segmentation
        output_probs = torch.sigmoid(output_logits)

        # Threshold at 0.5 for binary mask
        output_mask = (output_probs > 0.5).float()

        # Remove batch and channel dimensions
        mask_np = output_mask.squeeze(0).squeeze(0).cpu().numpy()  # (H, W)
        confidence_np = output_probs.squeeze(0).squeeze(0).cpu().numpy()  # (H, W)

    return mask_np, confidence_np


def postprocess_and_save(mask_np, confidence_np, original_image, original_size, output_dir):
    """
    Postprocess outputs and save to files.

    Args:
        mask_np: Binary mask numpy array
        confidence_np: Confidence map numpy array
        original_image: Original PIL image
        original_size: Tuple of (width, height)
        output_dir: Directory to save outputs

    Returns:
        Dictionary with metadata
    """
    os.makedirs(output_dir, exist_ok=True)

    # Resize mask back to original image size
    mask_img = Image.fromarray((mask_np * 255).astype(np.uint8), mode='L')
    mask_img = mask_img.resize(original_size, Image.NEAREST)  # Nearest neighbor for mask

    # Resize confidence map back to original size
    confidence_img = Image.fromarray((confidence_np * 255).astype(np.uint8), mode='L')
    confidence_img = confidence_img.resize(original_size, Image.BILINEAR)  # Bilinear for smooth heatmap

    # Save original image (resized if needed)
    original_resized = original_image.resize(original_size)
    original_resized.save(os.path.join(output_dir, 'original.png'))

    # Save binary mask
    mask_img.save(os.path.join(output_dir, 'mask.png'))

    # Create and save confidence heatmap with colormap
    confidence_np_resized = np.array(confidence_img) / 255.0
    heatmap_colored = cm.jet(confidence_np_resized)[:, :, :3]  # Get RGB only (drop alpha)
    heatmap_img = Image.fromarray((heatmap_colored * 255).astype(np.uint8), mode='RGB')
    heatmap_img.save(os.path.join(output_dir, 'confidence.png'))

    # Calculate statistics
    metadata = {
        'status': 'success',
        'originalSize': list(original_size),  # [width, height]
        'modelInputSize': [mask_np.shape[1], mask_np.shape[0]],  # [width, height]
        'threshold': 0.5,
        'meanConfidence': float(confidence_np.mean()),
        'maxConfidence': float(confidence_np.max()),
        'minConfidence': float(confidence_np.min())
    }

    # Save metadata
    with open(os.path.join(output_dir, 'metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=2)

    return metadata


def write_error(output_dir, error_message):
    """Write error to output directory."""
    os.makedirs(output_dir, exist_ok=True)
    error_data = {
        'status': 'error',
        'message': error_message
    }
    with open(os.path.join(output_dir, 'error.json'), 'w') as f:
        json.dump(error_data, f, indent=2)


def main():
    """Main inference pipeline."""
    args = parse_arguments()

    try:
        # Parse model configuration
        print(f"[INFO] Parsing model configuration...")
        config = json.loads(args.config_json)

        # Validate required config fields
        required_fields = [
            'input_channels', 'output_channels', 'base_filters', 'depth',
            'kernel_size', 'num_convs_per_block', 'pooling_type', 'pooling_size',
            'upsampling_type', 'upsampling_size', 'use_batch_norm', 'activation',
            'dropout_rate', 'skip_connections', 'filter_multiplier'
        ]
        for field in required_fields:
            if field not in config:
                raise ValueError(f"Missing required config field: {field}")

        # Load model
        print(f"[INFO] Loading model from {args.model_path}...")
        model = load_model(args.model_path, config)
        print(f"[INFO] Model loaded successfully")

        # Preprocess image
        print(f"[INFO] Preprocessing image from {args.image_path}...")
        image_tensor, original_image, original_size = preprocess_image(
            args.image_path,
            config['input_channels']
        )
        print(f"[INFO] Image preprocessed: original size {original_size}, tensor shape {image_tensor.shape}")

        # Run inference
        print(f"[INFO] Running inference...")
        mask_np, confidence_np = run_inference(model, image_tensor)
        print(f"[INFO] Inference completed")

        # Postprocess and save
        print(f"[INFO] Saving outputs to {args.output_dir}...")
        metadata = postprocess_and_save(
            mask_np,
            confidence_np,
            original_image,
            original_size,
            args.output_dir
        )

        print(f"[SUCCESS] Inference completed successfully!")
        print(f"[INFO] Mean confidence: {metadata['meanConfidence']:.4f}")
        print(f"[INFO] Max confidence: {metadata['maxConfidence']:.4f}")
        print(f"[INFO] Min confidence: {metadata['minConfidence']:.4f}")

        return 0

    except FileNotFoundError as e:
        error_msg = f"File not found: {str(e)}"
        print(f"[ERROR] {error_msg}", file=sys.stderr)
        write_error(args.output_dir, error_msg)
        return 1

    except json.JSONDecodeError as e:
        error_msg = f"Invalid JSON configuration: {str(e)}"
        print(f"[ERROR] {error_msg}", file=sys.stderr)
        write_error(args.output_dir, error_msg)
        return 1

    except ValueError as e:
        error_msg = f"Invalid configuration: {str(e)}"
        print(f"[ERROR] {error_msg}", file=sys.stderr)
        write_error(args.output_dir, error_msg)
        return 1

    except Exception as e:
        error_msg = f"Inference failed: {type(e).__name__}: {str(e)}"
        print(f"[ERROR] {error_msg}", file=sys.stderr)
        write_error(args.output_dir, error_msg)
        return 1


if __name__ == '__main__':
    sys.exit(main())
