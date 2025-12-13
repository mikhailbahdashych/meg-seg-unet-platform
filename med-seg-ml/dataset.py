import os
from pathlib import Path
from typing import Tuple, Optional, Callable

import torch
from torch.utils.data import Dataset
from PIL import Image
import numpy as np
import albumentations as A
from albumentations.pytorch import ToTensorV2


class MedicalImageDataset(Dataset):
    """
    Dataset loader for medical image segmentation.
    Expects images and masks to be in separate folders with matching filenames.
    """

    def __init__(
        self,
        images_dir: str,
        masks_dir: str,
        image_size: Tuple[int, int] = (256, 256),
        transform: Optional[Callable] = None,
        augment: bool = False
    ):
        """
        Args:
            images_dir: Directory containing input images
            masks_dir: Directory containing mask images
            image_size: Target size for resizing (height, width)
            transform: Custom albumentations transform (overrides default)
            augment: Whether to apply data augmentation
        """
        self.images_dir = Path(images_dir)
        self.masks_dir = Path(masks_dir)
        self.image_size = image_size
        self.augment = augment

        # Get all image files
        self.image_files = self._get_image_files()

        # Verify that masks exist for all images
        self._verify_masks()

        # Set up transforms
        if transform is not None:
            self.transform = transform
        else:
            self.transform = self._get_default_transform()

        print(f"Dataset initialized with {len(self.image_files)} image-mask pairs")

    def _get_image_files(self):
        """Get list of image files from images directory"""
        extensions = ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp']
        image_files = []

        for ext in extensions:
            image_files.extend(list(self.images_dir.glob(f'*{ext}')))
            image_files.extend(list(self.images_dir.glob(f'*{ext.upper()}')))

        # Sort for consistency
        image_files = sorted(image_files)

        if len(image_files) == 0:
            raise ValueError(f"No images found in {self.images_dir}")

        return image_files

    def _verify_masks(self):
        """Verify that a mask exists for each image"""
        missing_masks = []

        for image_file in self.image_files:
            mask_file = self.masks_dir / image_file.name

            # Try alternative extensions if exact match not found
            if not mask_file.exists():
                # Try with different extensions
                found = False
                base_name = image_file.stem
                extensions = ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp']

                for ext in extensions:
                    alt_mask = self.masks_dir / f"{base_name}{ext}"
                    if alt_mask.exists():
                        found = True
                        break

                if not found:
                    missing_masks.append(image_file.name)

        if missing_masks:
            raise ValueError(
                f"Missing masks for {len(missing_masks)} images: {missing_masks[:5]}"
            )

    def _get_default_transform(self):
        """Get default transformation pipeline"""
        if self.augment:
            # Training transforms with augmentation
            return A.Compose([
                A.Resize(height=self.image_size[0], width=self.image_size[1]),
                A.HorizontalFlip(p=0.5),
                A.VerticalFlip(p=0.5),
                A.RandomRotate90(p=0.5),
                A.ShiftScaleRotate(
                    shift_limit=0.1,
                    scale_limit=0.1,
                    rotate_limit=15,
                    p=0.5
                ),
                A.OneOf([
                    A.GaussianBlur(blur_limit=3, p=1.0),
                    A.MedianBlur(blur_limit=3, p=1.0),
                ], p=0.3),
                A.OneOf([
                    A.RandomBrightnessContrast(
                        brightness_limit=0.2,
                        contrast_limit=0.2,
                        p=1.0
                    ),
                    A.HueSaturationValue(
                        hue_shift_limit=20,
                        sat_shift_limit=30,
                        val_shift_limit=20,
                        p=1.0
                    ),
                ], p=0.3),
                A.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                ),
                ToTensorV2()
            ])
        else:
            # Validation/test transforms without augmentation
            return A.Compose([
                A.Resize(height=self.image_size[0], width=self.image_size[1]),
                A.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                ),
                ToTensorV2()
            ])

    def _find_mask_file(self, image_file: Path) -> Path:
        """Find the corresponding mask file for an image"""
        # First try exact filename match
        mask_file = self.masks_dir / image_file.name
        if mask_file.exists():
            return mask_file

        # Try with different extensions
        base_name = image_file.stem
        extensions = ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp']

        for ext in extensions:
            alt_mask = self.masks_dir / f"{base_name}{ext}"
            if alt_mask.exists():
                return alt_mask

        raise FileNotFoundError(f"Mask not found for image: {image_file.name}")

    def _load_image(self, path: Path) -> np.ndarray:
        """Load image as numpy array"""
        image = Image.open(path).convert('RGB')
        return np.array(image)

    def _load_mask(self, path: Path) -> np.ndarray:
        """Load mask as numpy array (grayscale)"""
        mask = Image.open(path).convert('L')
        mask = np.array(mask)

        # Normalize mask to [0, 1]
        if mask.max() > 1:
            mask = mask / 255.0

        return mask

    def __len__(self) -> int:
        return len(self.image_files)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Get a single image-mask pair.

        Returns:
            image: Tensor of shape (C, H, W)
            mask: Tensor of shape (1, H, W)
        """
        # Load image and mask
        image_file = self.image_files[idx]
        mask_file = self._find_mask_file(image_file)

        image = self._load_image(image_file)
        mask = self._load_mask(mask_file)

        # Apply transforms
        transformed = self.transform(image=image, mask=mask)
        image = transformed['image']
        mask = transformed['mask']

        # Add channel dimension to mask if needed
        if mask.ndim == 2:
            mask = mask.unsqueeze(0)

        # Ensure mask is float
        mask = mask.float()

        return image, mask


def create_dataloaders(
    images_dir: str,
    masks_dir: str,
    batch_size: int = 4,
    validation_split: float = 0.2,
    image_size: Tuple[int, int] = (256, 256),
    num_workers: int = 4,
    seed: int = 42
):
    """
    Create training and validation dataloaders.

    Args:
        images_dir: Directory containing input images
        masks_dir: Directory containing mask images
        batch_size: Batch size for dataloaders
        validation_split: Fraction of data to use for validation
        image_size: Target size for images
        num_workers: Number of worker processes for data loading
        seed: Random seed for reproducibility

    Returns:
        train_loader, val_loader
    """
    from torch.utils.data import DataLoader, random_split

    # Create full dataset
    full_dataset = MedicalImageDataset(
        images_dir=images_dir,
        masks_dir=masks_dir,
        image_size=image_size,
        augment=True  # Augmentation will only apply to training set
    )

    # Split into train and validation
    total_size = len(full_dataset)
    val_size = int(total_size * validation_split)
    train_size = total_size - val_size

    # Set random seed for reproducibility
    generator = torch.Generator().manual_seed(seed)
    train_dataset, val_dataset = random_split(
        full_dataset,
        [train_size, val_size],
        generator=generator
    )

    # Create validation dataset with no augmentation
    val_dataset_no_aug = MedicalImageDataset(
        images_dir=images_dir,
        masks_dir=masks_dir,
        image_size=image_size,
        augment=False
    )

    # Update validation dataset to use no augmentation
    # We need to use the same indices as the split
    val_indices = val_dataset.indices
    val_dataset = torch.utils.data.Subset(val_dataset_no_aug, val_indices)

    # Create dataloaders
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=True
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True
    )

    print(f"Training samples: {len(train_dataset)}")
    print(f"Validation samples: {len(val_dataset)}")

    return train_loader, val_loader


if __name__ == '__main__':
    # Test the dataset loader
    print("Testing MedicalImageDataset...")

    # This is a test - you would replace with actual paths
    # dataset = MedicalImageDataset(
    #     images_dir='/path/to/images',
    #     masks_dir='/path/to/masks',
    #     image_size=(256, 256),
    #     augment=True
    # )
    #
    # image, mask = dataset[0]
    # print(f"Image shape: {image.shape}")
    # print(f"Mask shape: {mask.shape}")
    # print(f"Image dtype: {image.dtype}")
    # print(f"Mask dtype: {mask.dtype}")
    # print(f"Mask range: [{mask.min():.3f}, {mask.max():.3f}]")

    print("Dataset loader implementation complete!")
