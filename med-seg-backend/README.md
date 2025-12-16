# MedSeg Backend

NestJS REST API server providing backend orchestration for the MedSeg medical image segmentation platform.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Architecture](#architecture)
- [Database](#database)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The MedSeg Backend is a NestJS application that serves as the API orchestration layer for the medical image segmentation platform. It handles dataset uploads, manages model training workflows, coordinates Python ML scripts, and provides persistent storage via AWS S3 with SQLite metadata caching.

The backend runs on port 4201 by default and exposes a REST API with the global prefix `/api`.

## Features

- **Dataset Management**: Upload validation, S3 storage, and metadata caching
- **File Validation**: ZIP structure validation and image-mask pair verification
- **Model Training Orchestration**: Python child process spawning and progress monitoring
- **AWS S3 Integration**: Persistent storage for datasets, models, and inference results
- **SQLite Database**: Local metadata cache mirroring S3 state
- **CORS Support**: Configured for frontend communication
- **Error Handling**: Comprehensive exception handling with user-friendly messages
- **TypeORM Integration**: Database abstraction with entity management
- **Environment-based Configuration**: Development and production environment support

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **NestJS** | 10.x | Backend framework |
| **Node.js** | 18+ | JavaScript runtime |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **TypeORM** | 0.3.x | Database ORM |
| **SQLite** | 3.x | Metadata database |
| **AWS SDK v3** | Latest | S3 storage integration |
| **Multer** | 1.4.x | File upload handling |
| **Jest** | 29.x | Testing framework |

## Prerequisites

Before installing the backend, ensure you have:

- **Node.js**: Version 18.0 or higher
- **npm**: Version 9.0 or higher
- **AWS Account**: With S3 bucket access and IAM credentials
- **Python**: Version 3.9 or higher (for ML script execution)

## Installation

1. Navigate to the backend directory:

```bash
cd med-seg-backend
```

2. Install dependencies:

```bash
npm install
```

This installs all required packages including NestJS core, AWS SDK, TypeORM, and development tools.

## Configuration

### Environment Variables

Create environment files in the root of the backend directory:

**`.env.development`** (for development):

```bash
# Server Configuration
API_PORT=4201
NODE_ENV=development
```

**`.env.production`** (for production):

```bash
# Server Configuration
API_PORT=4201
NODE_ENV=production
```

### TypeScript Path Aliases

The backend uses path aliases for cleaner imports:

```typescript
// Instead of: import { Dataset } from '../../datasets/entities/dataset.entity'
// Use: import { Dataset } from '@datasets/entities/dataset.entity'
```

Configured aliases in `tsconfig.json`:
- `@datasets/*` - Dataset module
- `@models/*` - Models module
- `@training/*` - Training module
- `@shared/*` - Shared services
- `@common/*` - Common utilities

### CORS Configuration

CORS is configured in `src/main.ts` to allow requests from:
- http://localhost:4200 (frontend dev server)
- http://localhost:4202
- http://localhost:8080
- http://127.0.0.1:8080
- http://localhost:4000

Modify `src/main.ts` to add additional origins.

## Running the Application

### Development Mode

Start the server with hot-reload:

```bash
npm run start:dev
```

The server will start on `http://localhost:4201` with API endpoints at `http://localhost:4201/api`.

### Production Mode

Build and start in production mode:

```bash
npm run build
npm run start:prod
```

### Watch Mode

Start with file watching (no hot-reload):

```bash
npm run start
```

## Project Structure

```
med-seg-backend/
|
+-- src/
|   +-- datasets/                    # Dataset Management Module
|   |   +-- entities/                # TypeORM entities
|   |   |   +-- dataset.entity.ts
|   |   +-- dto/                     # Data Transfer Objects
|   |   |   +-- upload-dataset.dto.ts
|   |   +-- datasets.controller.ts   # REST endpoints
|   |   +-- datasets.service.ts      # Business logic
|   |   +-- datasets.module.ts
|   |
|   +-- models/                      # Model Management Module
|   |   +-- entities/
|   |   |   +-- model.entity.ts
|   |   +-- dto/
|   |   +-- models.controller.ts
|   |   +-- models.service.ts
|   |   +-- models.module.ts
|   |
|   +-- training/                    # Training Orchestration Module
|   |   +-- training.controller.ts
|   |   +-- training.service.ts
|   |   +-- training.module.ts
|   |
|   +-- settings/                    # Settings Module
|   |   +-- settings.controller.ts
|   |   +-- settings.service.ts
|   |   +-- settings.module.ts
|   |
|   +-- shared/                      # Shared Services
|   |   +-- s3.service.ts            # AWS S3 operations
|   |   +-- file-validation.service.ts
|   |   +-- api-config.service.ts
|   |   +-- shared.module.ts
|   |
|   +-- common/                      # Common Utilities
|   |   +-- exceptions/              # Custom exceptions
|   |   +-- filters/                 # Exception filters
|   |   +-- interceptors/            # HTTP interceptors
|   |   +-- guards/                  # Route guards
|   |
|   +-- app.module.ts                # Root application module
|   +-- app.controller.ts            # Root controller
|   +-- app.service.ts               # Root service
|   +-- main.ts                      # Application entry point
|
+-- temp/                            # Temporary file uploads
|   +-- uploads/                     # Multer upload directory
|
+-- test/                            # End-to-end tests
+-- .env.development                 # Development environment
+-- .env.production                  # Production environment
+-- tsconfig.json                    # TypeScript configuration
+-- nest-cli.json                    # NestJS CLI configuration
+-- package.json                     # Dependencies and scripts
+-- README.md                        # This file
```

## API Documentation

### Global Prefix

All API endpoints are prefixed with `/api`.

### Datasets Endpoints

#### Upload Dataset

```
POST /api/datasets/upload
Content-Type: multipart/form-data

Body:
- file: ZIP file containing /images and /masks folders
- name: Dataset name (optional)

Response: 201 Created
{
  "id": 1,
  "name": "Chest X-Ray Dataset",
  "s3_bucket": "med-seg-platform",
  "s3_key": "datasets/abc-123/",
  "file_count": 100,
  "total_size_mb": 245.8,
  "status": "uploaded",
  "uploaded_at": "2024-01-15T10:30:00Z"
}
```

#### List Datasets

```
GET /api/datasets

Response: 200 OK
[
  {
    "id": 1,
    "name": "Chest X-Ray Dataset",
    "file_count": 100,
    "total_size_mb": 245.8,
    "status": "ready",
    "uploaded_at": "2024-01-15T10:30:00Z"
  }
]
```

#### Get Dataset Details

```
GET /api/datasets/:id

Response: 200 OK
{
  "id": 1,
  "name": "Chest X-Ray Dataset",
  "s3_bucket": "med-seg-platform",
  "s3_key": "datasets/abc-123/",
  "file_count": 100,
  "total_size_mb": 245.8,
  "status": "ready",
  "uploaded_at": "2024-01-15T10:30:00Z"
}
```

#### Delete Dataset

```
DELETE /api/datasets/:id

Response: 200 OK
{
  "message": "Dataset deleted successfully"
}
```

### Training Endpoints

#### Start Training

```
POST /api/training/train
Content-Type: application/json

Body:
{
  "datasetId": 1,
  "modelName": "U-Net Chest X-Ray Model",
  "hyperparameters": {
    "epochs": 50,
    "batch_size": 4,
    "learning_rate": 0.001,
    "optimizer": "adam",
    "loss_function": "dice",
    "input_channels": 3,
    "output_channels": 1,
    "base_filters": 64,
    "depth": 4
  }
}

Response: 201 Created
{
  "id": 1,
  "name": "U-Net Chest X-Ray Model",
  "dataset_id": 1,
  "status": "training",
  "hyperparameters": {...},
  "created_at": "2024-01-15T11:00:00Z"
}
```

#### Get Training Status

```
GET /api/training/:id/status

Response: 200 OK
{
  "id": 1,
  "status": "training",
  "progress": {
    "current_epoch": 23,
    "total_epochs": 50,
    "progress_percent": 46,
    "current_loss": 0.234,
    "current_dice_score": 0.876
  }
}
```

### Models Endpoints

#### List Models

```
GET /api/models

Response: 200 OK
[
  {
    "id": 1,
    "name": "U-Net Chest X-Ray Model",
    "dataset_id": 1,
    "status": "completed",
    "metrics": {
      "final_loss": 0.123,
      "final_dice_score": 0.912
    },
    "trained_at": "2024-01-15T12:30:00Z"
  }
]
```

#### Get Model Details

```
GET /api/models/:id

Response: 200 OK
{
  "id": 1,
  "name": "U-Net Chest X-Ray Model",
  "dataset_id": 1,
  "s3_bucket": "med-seg-platform",
  "s3_key": "models/def-456/model.pth",
  "hyperparameters": {...},
  "metrics": {...},
  "status": "completed",
  "trained_at": "2024-01-15T12:30:00Z"
}
```

#### Delete Model

```
DELETE /api/models/:id

Response: 200 OK
{
  "message": "Model deleted successfully"
}
```

## Architecture

### Module Organization

The backend follows NestJS modular architecture:

1. **App Module**: Root module importing all feature modules
2. **Feature Modules**: Self-contained modules (datasets, models, training, settings)
3. **Shared Module**: Reusable services exported to other modules
4. **Common Module**: Utilities, exceptions, and filters

### Service Layer Pattern

```
Controller (HTTP Layer)
    |
    v
Service (Business Logic)
    |
    +---> S3Service (Storage)
    |
    +---> FileValidationService (Validation)
    |
    +---> TypeORM Repository (Database)
```

### Python Child Process Execution

Training and inference are handled by spawning Python child processes:

```typescript
const pythonProcess = spawn('python3', [
  'train.py',
  '--config', 'config.json',
  '--data-dir', './data',
  '--download-from-s3'
]);

pythonProcess.stdout.on('data', (data) => {
  console.log(data.toString());
});
```

## Database

### SQLite Configuration

The backend uses SQLite with TypeORM for simplicity:

```typescript
TypeOrmModule.forRoot({
  type: 'sqlite',
  database: 'medseg.db',
  entities: [Dataset, Model, InferenceResult],
  synchronize: true // Auto-create tables in development
});
```

### Entity Definitions

Entities are defined using TypeORM decorators:

```typescript
@Entity('datasets')
export class Dataset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  s3_bucket: string;

  @Column()
  s3_key: string;

  @Column('int')
  file_count: number;

  @Column('real')
  total_size_mb: number;

  @Column()
  status: string;

  @CreateDateColumn()
  uploaded_at: Date;
}
```

### Database Migrations

For production environments, disable `synchronize` and use migrations:

```bash
npm run typeorm migration:generate -- -n MigrationName
npm run typeorm migration:run
```

## Development

### Available Scripts

```bash
npm run start           # Start application
npm run start:dev       # Start with hot-reload (watch mode)
npm run start:prod      # Start production build
npm run build           # Build for production
npm run lint            # Lint TypeScript files
npm run format          # Format code with Prettier + ESLint
npm run test            # Run unit tests
npm run test:watch      # Run tests in watch mode
npm run test:cov        # Generate test coverage report
npm run test:e2e        # Run end-to-end tests
```

### Code Generation

Generate new resources using NestJS CLI:

```bash
# Generate a new module
nest generate module feature-name

# Generate a new controller
nest generate controller feature-name

# Generate a new service
nest generate service feature-name

# Generate a complete CRUD resource
nest generate resource feature-name
```

### Development Guidelines

1. **Module Structure**:
   - Keep modules self-contained
   - Export only necessary services
   - Use dependency injection

2. **DTOs and Validation**:
   - Use class-validator for request validation
   - Define DTOs for all API endpoints
   - Use class-transformer for serialization

3. **Error Handling**:
   - Use built-in NestJS exceptions
   - Create custom exceptions when needed
   - Implement global exception filters

4. **Testing**:
   - Write unit tests for services
   - Write integration tests for controllers
   - Use Jest mocking capabilities

5. **Type Safety**:
   - Use TypeScript strict mode when possible
   - Define interfaces for complex types
   - Avoid using `any` type

## Testing

### Unit Tests

Run unit tests with Jest:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:cov
```

### Writing Unit Tests

Example service test:

```typescript
describe('DatasetsService', () => {
  let service: DatasetsService;
  let repository: Repository<Dataset>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatasetsService,
        {
          provide: getRepositoryToken(Dataset),
          useClass: Repository
        }
      ]
    }).compile();

    service = module.get<DatasetsService>(DatasetsService);
    repository = module.get<Repository<Dataset>>(getRepositoryToken(Dataset));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### End-to-End Tests

Run E2E tests:

```bash
npm run test:e2e
```

E2E tests are located in the `test/` directory.

## Deployment

### Production Build

Build the application:

```bash
npm run build
```

This creates a `dist/` folder with compiled JavaScript.

### Running in Production

```bash
NODE_ENV=production node dist/main.js
```

Or using npm script:

```bash
npm run start:prod
```

### Environment Variables

Ensure all production environment variables are set:
- `NODE_ENV=production`
- `API_PORT=4201`
- AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
- S3 configuration (AWS_S3_NAME, AWS_S3_BUCKET_URL)

### Process Management

Use PM2 for production process management:

```bash
npm install -g pm2
pm2 start dist/main.js --name medseg-backend
pm2 save
pm2 startup
```

### Docker Deployment

The project includes a `docker-compose.yml` file for containerized deployment.

## Troubleshooting

### Common Issues

**Issue**: Port 4201 already in use

**Solution**: Change port in `.env.development`:
```bash
API_PORT=4202
```

**Issue**: AWS S3 permission errors

**Solution**: Verify IAM credentials have S3 read/write permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:*"],
      "Resource": ["arn:aws:s3:::your-bucket/*"]
    }
  ]
}
```

**Issue**: SQLite database locked errors

**Solution**: Ensure only one instance is running or switch to PostgreSQL for production.

**Issue**: File upload fails with payload too large

**Solution**: Increase payload limit in `src/main.ts`:
```typescript
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
```

**Issue**: Python scripts not found

**Solution**: Verify Python scripts are in the correct path and Python 3.9+ is installed:
```bash
which python3
python3 --version
```

### Logging

Enable detailed logging by setting log level:

```typescript
const app = await NestFactory.create(AppModule, {
  logger: ['log', 'error', 'warn', 'debug', 'verbose']
});
```
