import os
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from tqdm import tqdm
import boto3
from botocore.exceptions import ClientError

from unet import create_unet
from unet_configurable import ConfigurableUNet
from dataset import create_dataloaders
from losses import get_loss_function


class ModelTrainer:
    """Main trainer class for U-Net model training"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"Using device: {self.device}")

        # Initialize S3 client if credentials provided
        self.s3_client = None
        if 'aws_credentials' in config:
            self._init_s3_client()

        # Create output directory
        self.output_dir = Path(config.get('output_dir', './output'))
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Initialize training state
        self.model = None
        self.optimizer = None
        self.criterion = None
        self.train_loader = None
        self.val_loader = None
        self.training_history = []

    def _init_s3_client(self):
        """Initialize boto3 S3 client with credentials"""
        aws_creds = self.config['aws_credentials']
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=aws_creds.get('access_key_id'),
            aws_secret_access_key=aws_creds.get('secret_access_key'),
            region_name=aws_creds.get('region', 'us-east-1')
        )
        print("S3 client initialized")

    def download_dataset_from_s3(self, data_dir: str):
        """Download dataset from S3 to local directory"""
        if not self.s3_client:
            raise ValueError("S3 client not initialized")

        bucket = self.config['dataset_s3_bucket']
        s3_key_prefix = self.config['dataset_s3_key']

        print(f"Downloading dataset from s3://{bucket}/{s3_key_prefix}")

        # Create local directories
        images_dir = Path(data_dir) / 'images'
        masks_dir = Path(data_dir) / 'masks'
        images_dir.mkdir(parents=True, exist_ok=True)
        masks_dir.mkdir(parents=True, exist_ok=True)

        # List and download all files from S3
        paginator = self.s3_client.get_paginator('list_objects_v2')

        for folder, local_dir in [('images', images_dir), ('masks', masks_dir)]:
            prefix = f"{s3_key_prefix}/{folder}/"
            print(f"Downloading {folder}...")

            file_count = 0
            for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                if 'Contents' not in page:
                    continue

                for obj in page['Contents']:
                    s3_key = obj['Key']
                    # Skip if it's just the folder itself
                    if s3_key.endswith('/'):
                        continue

                    # Get filename and download
                    filename = Path(s3_key).name
                    local_path = local_dir / filename

                    self.s3_client.download_file(bucket, s3_key, str(local_path))
                    file_count += 1

            print(f"Downloaded {file_count} {folder}")

        print(f"Dataset downloaded to {data_dir}")

    def upload_model_to_s3(self, model_path: str):
        """Upload trained model to S3"""
        if not self.s3_client:
            raise ValueError("S3 client not initialized")

        bucket = self.config['model_s3_bucket']
        s3_key = self.config['model_s3_key']

        print(f"Uploading model to s3://{bucket}/{s3_key}")

        try:
            self.s3_client.upload_file(model_path, bucket, s3_key)
            print(f"Model uploaded successfully")

            # Also upload training history
            history_path = str(Path(model_path).parent / 'training_history.json')
            if os.path.exists(history_path):
                history_s3_key = s3_key.replace('.pth', '_history.json')
                self.s3_client.upload_file(history_path, bucket, history_s3_key)
                print(f"Training history uploaded")

        except ClientError as e:
            print(f"Error uploading to S3: {e}")
            raise

    def setup_model(self):
        """Initialize model, optimizer, and loss function"""
        hyperparams = self.config['hyperparameters']

        # Create configurable U-Net model
        self.model = ConfigurableUNet(
            in_channels=hyperparams.get('input_channels', 3),
            out_channels=hyperparams.get('output_channels', 1),
            base_filters=hyperparams.get('base_filters', 64),
            depth=hyperparams.get('depth', 4),
            kernel_size=hyperparams.get('kernel_size', 3),
            num_convs_per_block=hyperparams.get('num_convs_per_block', 2),
            pooling_type=hyperparams.get('pooling_type', 'max'),
            pooling_size=hyperparams.get('pooling_size', 2),
            upsampling_type=hyperparams.get('upsampling_type', 'transpose'),
            upsampling_size=hyperparams.get('upsampling_size', 2),
            use_batch_norm=hyperparams.get('use_batch_norm', True),
            activation=hyperparams.get('activation', 'relu'),
            dropout_rate=hyperparams.get('dropout_rate', 0.0),
            skip_connections=hyperparams.get('skip_connections', True),
            filter_multiplier=hyperparams.get('filter_multiplier', 2)
        ).to(self.device)

        print(f"Model created: {sum(p.numel() for p in self.model.parameters()):,} parameters")

        # Setup optimizer
        optimizer_name = hyperparams.get('optimizer', 'adam').lower()
        learning_rate = hyperparams.get('learning_rate', 0.001)

        if optimizer_name == 'adam':
            self.optimizer = torch.optim.Adam(self.model.parameters(), lr=learning_rate)
        elif optimizer_name == 'sgd':
            self.optimizer = torch.optim.SGD(
                self.model.parameters(),
                lr=learning_rate,
                momentum=0.9
            )
        elif optimizer_name == 'rmsprop':
            self.optimizer = torch.optim.RMSprop(self.model.parameters(), lr=learning_rate)
        else:
            raise ValueError(f"Unknown optimizer: {optimizer_name}")

        print(f"Optimizer: {optimizer_name}, LR: {learning_rate}")

        # Setup loss function
        loss_name = hyperparams.get('loss_function', 'dice')
        self.criterion = get_loss_function(loss_name)
        print(f"Loss function: {loss_name}")

    def setup_dataloaders(self, data_dir: str):
        """Setup training and validation dataloaders"""
        hyperparams = self.config['hyperparameters']

        images_dir = str(Path(data_dir) / 'images')
        masks_dir = str(Path(data_dir) / 'masks')

        self.train_loader, self.val_loader = create_dataloaders(
            images_dir=images_dir,
            masks_dir=masks_dir,
            batch_size=hyperparams.get('batch_size', 4),
            validation_split=hyperparams.get('validation_split', 0.2),
            image_size=(256, 256),
            num_workers=2,
            seed=42,
            input_channels=hyperparams.get('input_channels', 1)
        )

    def train_epoch(self, epoch: int) -> float:
        """Train for one epoch"""
        self.model.train()
        total_loss = 0.0
        num_batches = 0

        progress_bar = tqdm(self.train_loader, desc=f'Epoch {epoch + 1}')

        for images, masks in progress_bar:
            images = images.to(self.device)
            masks = masks.to(self.device)

            # Forward pass
            self.optimizer.zero_grad()
            outputs = self.model(images)
            loss = self.criterion(outputs, masks)

            # Backward pass
            loss.backward()
            self.optimizer.step()

            # Update metrics
            total_loss += loss.item()
            num_batches += 1

            # Update progress bar
            progress_bar.set_postfix({'loss': f'{loss.item():.4f}'})

        avg_loss = total_loss / num_batches
        return avg_loss

    def validate(self) -> Dict[str, float]:
        """Validate the model"""
        self.model.eval()
        total_loss = 0.0
        num_batches = 0

        with torch.no_grad():
            for images, masks in self.val_loader:
                images = images.to(self.device)
                masks = masks.to(self.device)

                outputs = self.model(images)
                loss = self.criterion(outputs, masks)

                total_loss += loss.item()
                num_batches += 1

        avg_loss = total_loss / num_batches

        # Calculate Dice score
        dice_score = 1 - avg_loss if isinstance(self.criterion, type(get_loss_function('dice'))) else 0.0

        return {
            'val_loss': avg_loss,
            'dice_score': dice_score
        }

    def save_checkpoint(self, epoch: int, metrics: Dict[str, float]):
        """Save model checkpoint"""
        checkpoint_path = self.output_dir / f'checkpoint_epoch_{epoch + 1}.pth'

        torch.save({
            'epoch': epoch,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'metrics': metrics,
            'model_config': self.model.get_config(),
            'hyperparameters': self.config['hyperparameters']
        }, checkpoint_path)

        print(f"Checkpoint saved: {checkpoint_path}")

    def save_final_model(self) -> str:
        """Save the final trained model"""
        model_path = self.output_dir / 'model.pth'

        torch.save({
            'model_state_dict': self.model.state_dict(),
            'model_config': self.model.get_config(),
            'hyperparameters': self.config['hyperparameters'],
            'training_history': self.training_history
        }, model_path)

        print(f"Final model saved: {model_path}")

        # Save training history as JSON
        history_path = self.output_dir / 'training_history.json'
        with open(history_path, 'w') as f:
            json.dump({
                'hyperparameters': self.config['hyperparameters'],
                'history': self.training_history
            }, f, indent=2)

        return str(model_path)

    def write_status_file(self, status: str, **kwargs):
        """Write training status to file for monitoring"""
        status_file = self.output_dir / 'training_status.json'

        status_data = {
            'status': status,
            'timestamp': datetime.now().isoformat(),
            **kwargs
        }

        with open(status_file, 'w') as f:
            json.dump(status_data, f, indent=2)

    def train(self):
        """Main training loop"""
        hyperparams = self.config['hyperparameters']
        epochs = hyperparams.get('epochs', 50)

        print(f"\n{'='*60}")
        print(f"Starting training for {epochs} epochs")
        print(f"{'='*60}\n")

        self.write_status_file('training', current_epoch=0, total_epochs=epochs)

        best_val_loss = float('inf')

        try:
            for epoch in range(epochs):
                # Training
                train_loss = self.train_epoch(epoch)

                # Validation
                val_metrics = self.validate()
                val_loss = val_metrics['val_loss']
                dice_score = val_metrics['dice_score']

                # Record history
                epoch_metrics = {
                    'epoch': epoch + 1,
                    'train_loss': train_loss,
                    'val_loss': val_loss,
                    'dice_score': dice_score
                }
                self.training_history.append(epoch_metrics)

                # Print metrics
                print(f"\nEpoch {epoch + 1}/{epochs}")
                print(f"  Train Loss: {train_loss:.4f}")
                print(f"  Val Loss: {val_loss:.4f}")
                print(f"  Dice Score: {dice_score:.4f}")

                # Update status file
                progress_percent = int((epoch + 1) / epochs * 100)
                self.write_status_file(
                    'training',
                    current_epoch=epoch + 1,
                    total_epochs=epochs,
                    progress_percent=progress_percent,
                    current_loss=val_loss,
                    current_dice_score=dice_score
                )

                # Save best model
                if val_loss < best_val_loss:
                    best_val_loss = val_loss
                    print(f"  New best validation loss!")

            # Training completed
            print(f"\n{'='*60}")
            print(f"Training completed!")
            print(f"Best validation loss: {best_val_loss:.4f}")
            print(f"{'='*60}\n")

            # Save final model
            model_path = self.save_final_model()

            # Get final metrics
            final_metrics = self.training_history[-1]

            # Upload to S3 if configured
            if self.s3_client:
                self.upload_model_to_s3(model_path)

            # Write final status
            self.write_status_file(
                'completed',
                completed_at=datetime.now().isoformat(),
                final_loss=final_metrics['val_loss'],
                final_dice_score=final_metrics['dice_score'],
                total_epochs=epochs
            )

            return {
                'status': 'completed',
                'model_path': model_path,
                'metrics': final_metrics
            }

        except Exception as e:
            print(f"\nError during training: {e}")
            self.write_status_file('failed', error_message=str(e))
            raise


def main():
    parser = argparse.ArgumentParser(description='Train U-Net model for medical image segmentation')
    parser.add_argument('--config', type=str, required=True, help='Path to training config JSON file')
    parser.add_argument('--data-dir', type=str, default='./data', help='Directory for dataset')
    parser.add_argument('--output-dir', type=str, default='./output', help='Directory for outputs')
    parser.add_argument('--download-from-s3', action='store_true', help='Download dataset from S3')

    args = parser.parse_args()

    # Load configuration
    print(f"Loading config from {args.config}")
    with open(args.config, 'r') as f:
        config = json.load(f)

    # Override output directory if provided
    config['output_dir'] = args.output_dir

    # Create trainer
    trainer = ModelTrainer(config)

    # Download dataset from S3 if requested
    if args.download_from_s3:
        trainer.download_dataset_from_s3(args.data_dir)

    # Setup model and dataloaders
    trainer.setup_model()
    trainer.setup_dataloaders(args.data_dir)

    # Train
    result = trainer.train()

    print(f"\nTraining result: {result}")


if __name__ == '__main__':
    main()
