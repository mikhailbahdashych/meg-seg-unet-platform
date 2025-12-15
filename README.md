# MedSeg Platform

A web-based medical image segmentation platform using U-Net architecture for automated segmentation of medical images.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Workflows](#workflows)
- [Database Schema](#database-schema)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)

## Overview

MedSeg Platform is a full-stack web application designed for medical researchers and students to upload medical imaging datasets, train U-Net models, and perform automated image segmentation. This project demonstrates the integration of deep learning models with modern web technologies and cloud infrastructure.

The system provides an end-to-end workflow from dataset upload through model training to inference, with all data persisted in AWS S3 and metadata cached locally in SQLite.

## Features

- **Dataset Management**: Upload and manage medical imaging datasets via drag-and-drop or URL import
- **Model Training**: Train U-Net models with configurable hyperparameters including learning rate, batch size, and architecture depth
- **Batch Inference**: Apply trained models to multiple medical images for automated segmentation
- **Cloud Storage**: Persistent storage of datasets and models in AWS S3 with local metadata caching
- **Result Visualization**: View segmentation results with side-by-side and overlay comparisons
- **Progress Tracking**: Real-time training and inference progress monitoring

## Architecture

### System Components

The platform consists of three main components working together:

```
+------------------+
|  Angular 17      |  Frontend - User Interface
|  (Port 4200)     |
+--------+---------+
         | REST API (http://localhost:4201/api)
         v
+------------------+
|  NestJS          |  Backend - API Server & Orchestration
|  (Port 4201)     |
+--------+---------+
         |
         +---> SQLite Database (medseg.db) - Metadata Cache
         |
         +---> AWS S3 Bucket - Persistent Storage
         |
         +---> Python Scripts - ML Processing (Training & Inference)
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Angular 17 | User interface with standalone components architecture |
| **Backend** | NestJS (Node.js/TypeScript) | API server, request handling, and orchestration |
| **ML Processing** | Python 3.12 (PyTorch) | U-Net model training and inference |
| **Database** | SQLite | Metadata cache mirroring S3 state |
| **Storage** | AWS S3 | Persistent storage for datasets, models, and results |
| **API** | REST | Communication protocol between frontend and backend |

## Prerequisites

Before installing the platform, ensure you have the following installed:

- **Node.js**: Version 18.0 or higher
- **npm**: Version 9.0 or higher
- **Python**: Version 3.9 or higher
- **pip or uv**: Python package manager
- **Angular CLI**: Version 17.3 or higher
- **AWS Account**: With S3 bucket access and credentials

Optional but recommended:
- **CUDA-capable GPU**: For faster model training
- **Docker**: For containerized deployment

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd med-seg-platform
```

### 2. Install Frontend Dependencies

```bash
cd med-seg-frontend
npm install
cd ..
```

### 3. Install Backend Dependencies

```bash
cd med-seg-backend
npm install
cd ..
```

### 4. Install ML Dependencies

Using uv (recommended):

```bash
cd med-seg-ml
uv pip install -e .
cd ..
```

Or using pip:

```bash
cd med-seg-ml
pip install -r requirements.txt
cd ..
```

## Configuration

### Frontend Environment

The frontend API URL is configured in:

- **Development**: `med-seg-frontend/src/environments/environment.ts`
  ```typescript
  export const environment = {
    production: false,
    apiUrl: 'http://localhost:4201/api'
  };
  ```

- **Production**: `med-seg-frontend/src/environments/environment.prod.ts`
  ```typescript
  export const environment = {
    production: true,
    apiUrl: 'https://your-production-url.com/api'
  };
  ```

### AWS S3 Bucket Setup

1. Create an S3 bucket in your AWS account
2. Configure bucket permissions to allow read/write access
3. Enable CORS on the bucket if accessing from browser
4. Create IAM credentials with S3 read/write permissions
5. Use the credentials in your environment files

## Running the Application

### Development Mode

Start all services from the root directory using convenience scripts:

```bash
# Terminal 1 - Start Backend
npm run start:backend

# Terminal 2 - Start Frontend
npm run start:frontend
```

Or start services individually:

**Backend:**
```bash
cd med-seg-backend
npm run start:dev
```

**Frontend:**
```bash
cd med-seg-frontend
npm start
```

Access the application at `http://localhost:4200`

The backend API will be available at `http://localhost:4201/api`

### Production Mode

**Backend:**
```bash
cd med-seg-backend
npm run build
npm run start:prod
```

**Frontend:**
```bash
cd med-seg-frontend
npm run build
# Serve the dist/ folder using a web server like nginx
```

## Project Structure

```
med-seg-platform/
|
+-- med-seg-frontend/        # Angular 17 Frontend
|   +-- src/
|   |   +-- app/
|   |   |   +-- components/  # Reusable UI components
|   |   |   +-- pages/       # Feature pages (upload, train, inference)
|   |   |   +-- shared/      # Shared services and utilities
|   |   |   +-- app.config.ts
|   |   |   +-- app.routes.ts
|   |   +-- environments/    # Environment configurations
|   +-- package.json
|   +-- README.md
|
+-- med-seg-backend/         # NestJS Backend
|   +-- src/
|   |   +-- datasets/        # Dataset management module
|   |   +-- models/          # Model management module
|   |   +-- inference/       # Inference module
|   |   +-- shared/          # Shared services (S3, FileValidation)
|   |   +-- common/          # Common utilities and exceptions
|   |   +-- main.ts
|   +-- package.json
|   +-- README.md
|
+-- med-seg-ml/              # Python ML Scripts
|   +-- unet.py              # U-Net architecture
|   +-- unet_configurable.py # Configurable U-Net variants
|   +-- losses.py            # Loss functions
|   +-- dataset.py           # Dataset loader
|   +-- train.py             # Training script
|   +-- infer.py             # Inference script
|   +-- requirements.txt
|   +-- README.md
|
+-- package.json             # Root package.json with convenience scripts
+-- docker-compose.yml       # Docker composition file
+-- CLAUDE.md                # Development guidelines
+-- README.md                # This file
```

## Workflows

### 1. Dataset Upload Workflow

```
User uploads ZIP file (drag-and-drop or URL)
    |
    v
Frontend sends POST /api/datasets/upload
    |
    v
Backend validates ZIP structure (/images and /masks folders)
    |
    v
Backend validates image-mask pairs (matching filenames)
    |
    v
Backend uploads files to S3 (datasets/{uuid}/images and datasets/{uuid}/masks)
    |
    v
Metadata stored in SQLite (datasets table)
    |
    v
Temporary files cleaned up
    |
    v
Success response returned to frontend
```

**Supported Dataset Formats:**
- ZIP archive containing `/images` and `/masks` subdirectories
- Matching image-mask pairs with identical filenames
- Supported image formats: PNG, JPG, JPEG, TIF, TIFF, BMP, DICOM, NIfTI

### 2. Model Training Workflow

```
User selects dataset and configures training parameters
    |
    v
Frontend sends POST /api/models/train
    |
    v
Backend creates training configuration JSON
    |
    v
Backend spawns Python training script via child process
    |
    v
Python script downloads dataset from S3
    |
    v
Python trains U-Net model locally (with GPU if available)
    |
    v
Training progress written to output/training_status.json
    |
    v
Backend polls status file for progress updates
    |
    v
Trained model uploaded to S3 (models/{uuid}/model.pth)
    |
    v
Model metadata stored in SQLite (models table)
    |
    v
Training results returned to frontend
```

**Configurable Training Parameters:**
- Number of epochs (10-200)
- Learning rate (0.0001-0.01)
- Batch size (1-16)
- Optimizer (Adam, SGD, RMSprop)
- Loss function (Dice, BCE, Focal, Combined)
- U-Net architecture depth (3-5)
- Base filters (32, 64, 128)

### 3. Inference Workflow

```
User uploads image(s) and selects trained model
    |
    v
Frontend sends POST /api/inference/run
    |
    v
Backend retrieves model from S3 or cache
    |
    v
Backend spawns Python inference script via child process
    |
    v
Python performs segmentation on input images
    |
    v
Segmentation results uploaded to S3
    |
    v
Results metadata stored in SQLite (optional)
    |
    v
Segmentation results returned to frontend
    |
    v
Visualization displayed to user (overlay, side-by-side)
```

## Database Schema

### SQLite Database Tables

The backend uses TypeORM with SQLite for metadata management. The database file is `medseg.db`.

#### Table: datasets

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-incrementing unique identifier |
| name | TEXT | User-provided dataset name |
| s3_bucket | TEXT | AWS S3 bucket name |
| s3_key | TEXT | S3 object prefix/path |
| uploaded_at | TIMESTAMP | Upload timestamp (ISO 8601) |
| file_count | INTEGER | Number of image-mask pairs |
| total_size_mb | REAL | Total dataset size in megabytes |
| status | TEXT | Status: 'uploaded', 'processing', 'ready', 'error' |

#### Table: models

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-incrementing unique identifier |
| name | TEXT | User-provided model name |
| dataset_id | INTEGER | Foreign key to datasets.id |
| s3_bucket | TEXT | AWS S3 bucket name |
| s3_key | TEXT | S3 object key for model file |
| hyperparameters | TEXT (JSON) | Training configuration (epochs, lr, etc.) |
| metrics | TEXT (JSON) | Final metrics (dice_score, loss, etc.) |
| trained_at | TIMESTAMP | Training completion timestamp |
| status | TEXT | Status: 'training', 'completed', 'failed' |

#### Table: inference_results (Optional)

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-incrementing unique identifier |
| model_id | INTEGER | Foreign key to models.id |
| input_image_s3_key | TEXT | S3 path to input image |
| output_image_s3_key | TEXT | S3 path to segmentation result |
| created_at | TIMESTAMP | Inference timestamp |

## Development

### Available Scripts

From the root directory:

```bash
npm run start:backend     # Start backend in development mode
npm run start:frontend    # Start frontend in development mode
npm run format:backend    # Format backend code (Prettier + ESLint)
npm run format:frontend   # Format frontend code (Prettier + ESLint)
```

### Backend Development

```bash
cd med-seg-backend
npm run start:dev         # Start with hot-reload
npm run build             # Build for production
npm run lint              # Lint and auto-fix TypeScript
npm run test              # Run Jest unit tests
npm run test:watch        # Run tests in watch mode
npm run test:cov          # Generate test coverage report
npm run test:e2e          # Run end-to-end tests
```

### Frontend Development

```bash
cd med-seg-frontend
npm start                 # Start dev server (ng serve)
npm run build             # Build for production
npm run watch             # Build in watch mode
npm test                  # Run Jasmine/Karma tests
ng generate component name  # Generate new component
```

### Code Quality

Both frontend and backend use:
- **Prettier**: Code formatting
- **ESLint**: Linting and code quality
- **TypeScript**: Type safety

Format code before committing:

```bash
npm run format:backend
npm run format:frontend
```

### CORS Configuration

The backend allows CORS from the following origins:
- http://localhost:4200
- http://localhost:4202
- http://localhost:8080
- http://127.0.0.1:8080
- http://localhost:4000

Modify `med-seg-backend/src/main.ts` to add additional origins.

## Testing

### Backend Tests

```bash
cd med-seg-backend
npm run test              # Run all unit tests
npm run test:watch        # Run tests in watch mode
npm run test:cov          # Generate coverage report
npm run test:e2e          # Run end-to-end tests
```

### Frontend Tests

```bash
cd med-seg-frontend
npm test                  # Run Karma tests
```

## Deployment

### Docker Deployment

A `docker-compose.yml` file is provided for containerized deployment:

```bash
docker-compose up -d
```

This will start:
- Backend service on port 4201
- Frontend service on port 4200
- ML processing environment

### Manual Deployment

1. Build frontend: `cd med-seg-frontend && npm run build`
2. Build backend: `cd med-seg-backend && npm run build`
3. Deploy backend: Copy `dist/` folder and run `node dist/main.js`
4. Deploy frontend: Serve `dist/` folder with nginx or similar
5. Ensure Python environment is available for ML processing

### Environment Variables for Production

Ensure all production environment variables are set:
- `NODE_ENV=production`
- `API_PORT=4201`
- AWS credentials
- S3 bucket configuration

## Academic Context

### Learning Objectives

This project demonstrates practical implementation of:

1. **U-Net Architecture**: Understanding encoder-decoder networks for image segmentation
2. **Medical Image Processing**: Handling medical imaging datasets with proper preprocessing
3. **Full-Stack ML Development**: Integrating machine learning models with web applications
4. **Cloud Infrastructure**: Using AWS S3 for scalable data storage
5. **MLOps Fundamentals**: Model versioning, metadata management, and deployment

### Design Decisions

For educational purposes, the following simplifications were made:

- **Single-User System**: No authentication or authorization required
- **SQLite Database**: Chosen for simplicity over PostgreSQL or MySQL
- **Synchronous Operations**: Frontend polls for status updates instead of WebSockets
- **Local Training**: No distributed training or GPU cluster support
- **Basic Error Handling**: Focused on core functionality over edge cases
