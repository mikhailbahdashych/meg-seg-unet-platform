# MedSeg Frontend

Angular 17 web application providing the user interface for the MedSeg medical image segmentation platform.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Development](#development)
- [Testing](#testing)
- [Building for Production](#building-for-production)
- [Code Style](#code-style)
- [Troubleshooting](#troubleshooting)

## Overview

The MedSeg Frontend is an Angular 17 application that provides a modern, responsive user interface for medical image segmentation workflows. It enables users to upload datasets, configure and monitor model training, and perform inference with trained U-Net models.

The application uses Angular's standalone components architecture (no NgModules) and communicates with the NestJS backend via REST API.

## Features

- **Dataset Upload**: Drag-and-drop or URL-based dataset upload with real-time validation
- **Dataset Management**: View, search, and delete uploaded datasets
- **Model Training**: Configure training hyperparameters with an intuitive form interface
- **Training Monitoring**: Real-time progress tracking with visual indicators
- **Model Management**: Browse trained models with metrics and metadata
- **Inference**: Upload images and apply trained models for segmentation
- **Result Visualization**: Side-by-side and overlay comparison of original images and segmentation masks
- **Responsive Design**: Mobile-friendly interface with modern UI components

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Angular** | 17.3.4 | Frontend framework |
| **TypeScript** | 5.4.x | Type-safe JavaScript |
| **RxJS** | 7.x | Reactive programming |
| **Angular Router** | 17.x | Client-side routing |
| **HttpClient** | 17.x | HTTP communication |
| **Standalone Components** | N/A | Modern Angular architecture |

## Prerequisites

Ensure you have the following installed:

- **Node.js**: Version 18.0 or higher
- **npm**: Version 9.0 or higher
- **Angular CLI**: Version 17.3 or higher

Install Angular CLI globally if not already installed:

```bash
npm install -g @angular/cli@17
```

## Installation

1. Navigate to the frontend directory:

```bash
cd med-seg-frontend
```

2. Install dependencies:

```bash
npm install
```

This will install all required packages including Angular core libraries, development tools, and testing frameworks.

## Configuration

### Environment Files

The application uses Angular environment files for configuration:

**Development**: `src/environments/environment.ts`

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:4201/api'
};
```

**Production**: `src/environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://your-production-url.com/api'
};
```

### API Endpoints

The frontend communicates with the backend through the following endpoints:

- `POST /api/datasets/upload` - Upload dataset
- `GET /api/datasets` - List all datasets
- `GET /api/datasets/:id` - Get dataset details
- `DELETE /api/datasets/:id` - Delete dataset
- `POST /api/models/train` - Start model training
- `GET /api/models` - List all models
- `GET /api/models/:id` - Get model details
- `GET /api/models/:id/status` - Get training status
- `POST /api/inference/run` - Run inference
- `GET /api/inference/results` - List inference results

## Running the Application

### Development Server

Start the development server with hot-reload:

```bash
npm start
```

Or using Angular CLI directly:

```bash
ng serve
```

The application will be available at `http://localhost:4200`

Changes to source files will automatically reload the browser.

### Production Build

Build the application for production:

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Watch Mode

Build in watch mode for development:

```bash
npm run watch
```

This rebuilds the application automatically when files change.

## Project Structure

```
med-seg-frontend/
|
+-- src/
|   +-- app/
|   |   +-- components/          # Reusable UI components
|   |   |   +-- header/          # Application header
|   |   |   +-- layout/          # Layout wrapper
|   |   |   +-- sidebar/         # Navigation sidebar
|   |   |
|   |   +-- pages/               # Feature pages (routed components)
|   |   |   +-- home/            # Dashboard/home page
|   |   |   +-- upload/          # Dataset upload page
|   |   |   +-- train/           # Model training page
|   |   |   +-- models/          # Model list page
|   |   |   +-- model-details/   # Model details page
|   |   |   +-- inference/       # Inference page
|   |   |   +-- settings/        # Application settings
|   |   |
|   |   +-- shared/              # Shared utilities and services
|   |   |   +-- services/        # API services
|   |   |   |   +-- dataset.service.ts
|   |   |   |   +-- model.service.ts
|   |   |   |   +-- inference.service.ts
|   |   |   +-- models/          # TypeScript interfaces
|   |   |   +-- interceptors/    # HTTP interceptors
|   |   |
|   |   +-- app.config.ts        # Application configuration
|   |   +-- app.routes.ts        # Route definitions
|   |   +-- app.component.ts     # Root component
|   |
|   +-- environments/            # Environment configurations
|   |   +-- environment.ts       # Development config
|   |   +-- environment.prod.ts  # Production config
|   |
|   +-- assets/                  # Static assets (images, icons)
|   +-- styles.css               # Global styles
|   +-- index.html               # HTML entry point
|   +-- main.ts                  # Application bootstrap
|
+-- angular.json                 # Angular CLI configuration
+-- tsconfig.json                # TypeScript configuration
+-- package.json                 # Dependencies and scripts
+-- README.md                    # This file
```

## Architecture

### Standalone Components

The application uses Angular 17's standalone components architecture:

- No NgModules required
- Direct imports in component metadata
- Simpler dependency management
- Better tree-shaking for smaller bundles

Example:

```typescript
@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent {
  // Component logic
}
```

### Routing

Routes are defined in `app.routes.ts` with lazy loading support:

```typescript
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'upload', component: UploadComponent },
  { path: 'train', component: TrainComponent },
  { path: 'models', component: ModelsComponent },
  { path: 'models/:id', component: ModelDetailsComponent },
  { path: 'inference', component: InferenceComponent }
];
```

### Services

Services handle API communication and state management:

- **DatasetService**: Dataset upload, listing, and deletion
- **ModelService**: Model training, status polling, and retrieval
- **InferenceService**: Inference execution and result retrieval

All services use Angular's HttpClient with RxJS observables.

### Data Flow

```
User Interaction
    |
    v
Component (UI)
    |
    v
Service (API calls)
    |
    v
Backend REST API
    |
    v
Response Observable
    |
    v
Component (Update UI)
```

## Development

### Code Scaffolding

Generate new components, services, and other artifacts:

```bash
# Generate a new component
ng generate component components/component-name

# Generate a new service
ng generate service shared/services/service-name

# Generate a new interface
ng generate interface shared/models/model-name

# Generate a new directive
ng generate directive shared/directives/directive-name

# Generate a new pipe
ng generate pipe shared/pipes/pipe-name
```

### Development Guidelines

1. **Component Organization**:
   - Place reusable components in `components/`
   - Place routed feature pages in `pages/`
   - Keep components focused and single-purpose

2. **Service Layer**:
   - All API calls should go through services
   - Use RxJS operators for data transformation
   - Handle errors gracefully with user-friendly messages

3. **Type Safety**:
   - Define interfaces for all data models in `shared/models/`
   - Use strong typing for service methods and component properties
   - Avoid using `any` type

4. **Reactive Programming**:
   - Use RxJS observables for asynchronous operations
   - Unsubscribe from observables to prevent memory leaks
   - Use async pipe in templates when possible

5. **Code Style**:
   - Follow Angular style guide
   - Use Prettier and ESLint for consistent formatting
   - Write self-documenting code with clear variable names

### Hot Reload

The development server supports hot module replacement. Changes to TypeScript, HTML, and CSS files will automatically reload the browser.

## Testing

### Unit Tests

Run unit tests using Karma and Jasmine:

```bash
npm test
```

This launches the Karma test runner in watch mode.

### Writing Tests

Example component test:

```typescript
describe('UploadComponent', () => {
  let component: UploadComponent;
  let fixture: ComponentFixture<UploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(UploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

### End-to-End Tests

E2E tests can be added using frameworks like Cypress or Playwright:

```bash
# Install Cypress
npm install --save-dev cypress

# Run E2E tests
npx cypress open
```

## Building for Production

### Production Build

Create an optimized production build:

```bash
npm run build
```

Build artifacts will be stored in `dist/med-seg-frontend/browser/`.

### Build Options

- **Ahead-of-Time (AOT) Compilation**: Enabled by default in production
- **Tree Shaking**: Removes unused code for smaller bundles
- **Minification**: Reduces file sizes
- **Source Maps**: Generated for debugging

### Serving the Production Build

Serve the production build using a static file server:

```bash
# Using Python HTTP server
cd dist/med-seg-frontend/browser
python3 -m http.server 8080

# Using Node.js http-server
npm install -g http-server
http-server dist/med-seg-frontend/browser -p 8080
```

Or deploy to a web server like nginx, Apache, or cloud platforms (AWS S3, Netlify, Vercel).

## Code Style

### Formatting

Format code using Prettier and ESLint:

```bash
npm run format
```

### ESLint Configuration

The project uses ESLint for TypeScript linting. Configuration is in `.eslintrc.json`.

Run linting:

```bash
npm run lint
```

Auto-fix linting issues:

```bash
npm run lint -- --fix
```

### Prettier Configuration

Prettier ensures consistent code formatting. Configuration is in `.prettierrc`.

## Troubleshooting

### Common Issues

**Issue**: `ng: command not found`

**Solution**: Install Angular CLI globally:
```bash
npm install -g @angular/cli
```

**Issue**: Port 4200 already in use

**Solution**: Use a different port:
```bash
ng serve --port 4202
```

**Issue**: API calls failing with CORS errors

**Solution**: Ensure backend CORS configuration allows `http://localhost:4200`:
```typescript
// In backend main.ts
app.enableCors({
  origin: ['http://localhost:4200'],
  credentials: true
});
```

**Issue**: Module not found errors after installation

**Solution**: Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

**Issue**: Type errors in IDE but builds successfully

**Solution**: Restart TypeScript language server in your IDE or run:
```bash
npm run build
```



