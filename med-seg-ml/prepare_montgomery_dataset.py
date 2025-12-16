#!/usr/bin/env python3
"""
Montgomery County Chest X-Ray Dataset Preparation Script
Combines left and right lung masks and organizes dataset for MedSeg Platform upload
"""

import os
import shutil
from pathlib import Path
import zipfile
from PIL import Image
import numpy as np

def combine_masks(left_mask_path, right_mask_path, output_path):
    """
    Combine left and right lung masks into a single binary mask

    Args:
        left_mask_path: Path to left lung mask
        right_mask_path: Path to right lung mask
        output_path: Path to save combined mask
    """
    # Read masks as grayscale
    left_mask = Image.open(left_mask_path).convert('L')
    right_mask = Image.open(right_mask_path).convert('L')

    # Convert to numpy arrays
    left_array = np.array(left_mask)
    right_array = np.array(right_mask)

    # Combine masks (binary OR operation)
    # Any pixel > 0 in either mask becomes 255 in combined mask
    combined_array = np.maximum(left_array, right_array)

    # Convert back to image and save
    combined_mask = Image.fromarray(combined_array, mode='L')
    combined_mask.save(output_path)


def prepare_dataset(source_dir, output_dir):
    """
    Prepare Montgomery dataset for MedSeg Platform upload

    Args:
        source_dir: Path to MontgomerySet directory
        output_dir: Path to output directory (will create montgomery-dataset)
    """
    source_path = Path(source_dir)
    output_path = Path(output_dir) / "montgomery-dataset"

    # Create output directories
    images_dir = output_path / "images"
    masks_dir = output_path / "masks"

    images_dir.mkdir(parents=True, exist_ok=True)
    masks_dir.mkdir(parents=True, exist_ok=True)

    print(f"Source directory: {source_path}")
    print(f"Output directory: {output_path}")
    print()

    # Paths to source data
    cxr_dir = source_path / "CXR_png"
    left_mask_dir = source_path / "ManualMask" / "leftMask"
    right_mask_dir = source_path / "ManualMask" / "rightMask"

    # Validate source directories exist
    if not cxr_dir.exists():
        raise FileNotFoundError(f"CXR_png directory not found: {cxr_dir}")
    if not left_mask_dir.exists():
        raise FileNotFoundError(f"leftMask directory not found: {left_mask_dir}")
    if not right_mask_dir.exists():
        raise FileNotFoundError(f"rightMask directory not found: {right_mask_dir}")

    # Get list of all image files
    image_files = sorted([f for f in os.listdir(cxr_dir) if f.endswith('.png')])

    print(f"Found {len(image_files)} images")
    print("Processing...")
    print()

    processed_count = 0
    skipped_count = 0

    for image_file in image_files:
        image_path = cxr_dir / image_file
        left_mask_path = left_mask_dir / image_file
        right_mask_path = right_mask_dir / image_file

        # Check if both masks exist
        if not left_mask_path.exists() or not right_mask_path.exists():
            print(f"⚠️  Skipping {image_file}: Missing mask files")
            skipped_count += 1
            continue

        try:
            # Copy image
            output_image_path = images_dir / image_file
            shutil.copy2(image_path, output_image_path)

            # Combine and save mask
            output_mask_path = masks_dir / image_file
            combine_masks(left_mask_path, right_mask_path, output_mask_path)

            processed_count += 1

            if processed_count % 10 == 0:
                print(f"Processed {processed_count}/{len(image_files)} images...")

        except Exception as e:
            print(f" Error processing {image_file}: {e}")
            skipped_count += 1
            continue

    print()
    print("=" * 60)
    print(f" Processing complete!")
    print(f"   Processed: {processed_count} images")
    print(f"   Skipped: {skipped_count} images")
    print()
    print(f"Output directory: {output_path}")
    print(f"   Images: {len(list(images_dir.glob('*.png')))} files")
    print(f"   Masks: {len(list(masks_dir.glob('*.png')))} files")
    print("=" * 60)

    return output_path, processed_count


def create_zip(dataset_dir, output_zip_path):
    """
    Create a ZIP file from the prepared dataset

    Args:
        dataset_dir: Path to montgomery-dataset directory
        output_zip_path: Path to output ZIP file
    """
    dataset_path = Path(dataset_dir)
    zip_path = Path(output_zip_path)

    print()
    print("Creating ZIP file...")

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add images directory
        images_dir = dataset_path / "images"
        for image_file in images_dir.glob('*.png'):
            arcname = f"images/{image_file.name}"
            zipf.write(image_file, arcname)

        # Add masks directory
        masks_dir = dataset_path / "masks"
        for mask_file in masks_dir.glob('*.png'):
            arcname = f"masks/{mask_file.name}"
            zipf.write(mask_file, arcname)

    zip_size_mb = zip_path.stat().st_size / (1024 * 1024)

    print(f" ZIP file created: {zip_path}")
    print(f"   Size: {zip_size_mb:.2f} MB")
    print()
    print("🎉 Dataset ready for upload to MedSeg Platform!")
    print()


def main():
    """Main execution function"""
    # Paths
    script_dir = Path(__file__).parent
    source_dir = script_dir / "MontgomerySet"
    output_base_dir = script_dir
    output_zip_path = script_dir / "montgomery-dataset.zip"

    print("=" * 60)
    print("Montgomery County Dataset Preparation")
    print("=" * 60)
    print()

    # Check if source directory exists
    if not source_dir.exists():
        print(f" Error: MontgomerySet directory not found at {source_dir}")
        print("   Please ensure the MontgomerySet folder is in the same directory as this script")
        return

    # Prepare dataset
    try:
        dataset_dir, count = prepare_dataset(source_dir, output_base_dir)

        if count == 0:
            print(" No images were processed. Please check the source directory structure.")
            return

        # Create ZIP file
        create_zip(dataset_dir, output_zip_path)

        print("=" * 60)
        print("Next Steps:")
        print("=" * 60)
        print("1. Upload montgomery-dataset.zip to MedSeg Platform")
        print("2. Wait for dataset validation and S3 upload")
        print("3. Navigate to Train page")
        print("4. Select 'montgomery-dataset' from dropdown")
        print("5. Enter model name and click 'Start Training'")
        print("=" * 60)

    except Exception as e:
        print(f" Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
