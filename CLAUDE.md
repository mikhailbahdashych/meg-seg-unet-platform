# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MedSeg Platform is a medical image segmentation application using U-Net architecture. It's a full-stack TypeScript/Python project for medical researchers and students to upload datasets, train U-Net models, and perform automated image segmentation.

**Academic Context**: Master's degree project for "Architectures of Neural Networks" course, focusing on U-Net implementation, medical image processing, and MLOps fundamentals.

## Architecture

The system consists of three main components:

1. **Frontend** (`med-seg-frontend/`): Angular 17 application providing the UI
2. **Backend** (`med-seg-backend/`): NestJS API server for orchestration and business logic
3. **ML Processing**: Python scripts (to be implemented) for U-Net training and inference

### Data Flow

- Backend orchestrates all operations via REST API (global prefix: `/api`)
- NestJS spawns Python child processes for ML tasks (training/inference)
- SQLite database acts as metadata cache mirroring AWS S3 state
- AWS S3 provides persistent storage for datasets and trained models
- Backend runs on port 4201 (configurable via `API_PORT` env var)
- Frontend runs on port 4200 by default

### Database Schema

**SQLite tables** (schema defined in TypeORM entities):
- `datasets`: Stores dataset metadata (name, s3_bucket, s3_key, file_count, total_size_mb, status)
- `models`: Stores model metadata (to be implemented)
- `inference_results`: Stores inference outputs (optional)

## Development Commands

### Root Level
```bash
npm run start:backend      # Start NestJS backend in dev mode
npm run start:frontend     # Start Angular frontend
npm run format:backend     # Format backend code (Prettier + ESLint)
npm run format:frontend    # Format frontend code (Prettier + ESLint)
```

### Backend (`med-seg-backend/`)
```bash
npm run start:dev          # Start in watch mode (port 4201)
npm run build              # Build for production
npm run lint               # Lint and auto-fix TypeScript files
npm run test               # Run Jest unit tests
npm run test:watch         # Run tests in watch mode
npm run test:cov           # Run tests with coverage
npm run test:e2e           # Run end-to-end tests
npm run format             # Format with Prettier + ESLint
```

### Frontend (`med-seg-frontend/`)
```bash
npm start                  # Start dev server (ng serve)
npm run build              # Build for production
npm run watch              # Build in watch mode
npm test                   # Run Jasmine/Karma tests
npm run format             # Format with Prettier + ESLint
```

## Configuration

### Backend Environment Variables
Environment variables are loaded from `.env.development` or `.env.production` based on `NODE_ENV`:
- `API_PORT`: Backend port (default: 4201)
- `AWS_ACCESS_KEY_ID`: AWS credentials
- `AWS_SECRET_ACCESS_KEY`: AWS credentials
- `AWS_REGION`: AWS region (e.g., eu-central-1)
- `AWS_S3_NAME`: S3 bucket for datasets/models
- `AWS_S3_BUCKET_URL`: S3 bucket URL

### Frontend Environment
API URL configured in `src/environments/environment.ts` (dev) and `environment.prod.ts` (prod):
- Development: `http://localhost:4201/api`

### CORS Configuration
Backend allows CORS from: localhost:4200, localhost:4202, localhost:8080, 127.0.0.1:8080, localhost:4000

### Request Size Limits
Backend accepts JSON/URL-encoded payloads up to 50mb (configured in `med-seg-backend/src/main.ts:18-19`)

## Code Architecture Notes

### Backend Structure
- **Monorepo structure**: Two separate npm projects (`med-seg-backend`, `med-seg-frontend`) with root-level convenience scripts
- **Module organization**: Standard NestJS structure with modules, controllers, and services
  - `datasets/`: Dataset management (upload, validation, S3 integration)
  - `shared/`: Shared services (S3Service, FileValidationService, ApiConfigService)
  - `common/`: Common utilities and exceptions
- **Path aliases**: Backend uses TypeScript path aliases defined in `tsconfig.json`:
  - `@datasets/*` → `src/datasets/*`
  - `@shared/*` → `src/shared/*`
  - `@common/*` → `src/common/*`
- **Database**: TypeORM with SQLite (`medseg.db`), synchronize enabled for development
- **File uploads**: Multer configured to save uploads to `temp/uploads/` directory
- **S3 Integration**: AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`)

### Frontend Structure
- **Angular 17**: Standalone components architecture (no NgModules)
- **Routing**: Centralized in `app.routes.ts` with LayoutComponent wrapper
- **Services**: HttpClient-based services in `app/shared/services/`
- **Pages**: Feature components in `app/pages/`
- **Components**: Reusable components in `app/components/`

### Key Workflows

#### Dataset Upload Flow
1. User uploads ZIP file via `POST /api/datasets/upload`
2. Multer saves file to `temp/uploads/` directory
3. Backend validates file size and ZIP structure (requires `/images` and `/masks` folders)
4. Backend validates that image-mask pairs match by filename
5. Backend uploads validated files to S3 under `datasets/{uuid}/images` and `datasets/{uuid}/masks`
6. Metadata stored in SQLite `datasets` table
7. Temp files cleaned up after upload completes or fails
8. On error, S3 files are cleaned up automatically

#### Dataset Deletion Flow
1. Delete from S3 via `S3Service.deleteDirectory()`
2. Delete from SQLite database
3. S3 deletion errors are logged but don't prevent database deletion

## Development Guidelines

- Both frontend and backend use Prettier + ESLint for formatting
- Backend uses Jest for testing, frontend uses Jasmine/Karma
- TypeScript strict mode is **disabled** in backend (`strictNullChecks: false`, `noImplicitAny: false`)
- Code must be formatted before commits (use `npm run format`)
- No authentication: Single-user system for academic purposes
- Synchronous operations: Frontend polls for status updates (no WebSockets)

## Known Limitations

- SQLite chosen for simplicity over PostgreSQL/MySQL
- No model training/inference implemented yet (Python scripts pending)
- No WebSocket support for real-time updates
- Single-user system (no authentication/authorization)
- Backend TypeScript strict mode disabled for faster development
