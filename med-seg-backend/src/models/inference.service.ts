import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as AdmZip from 'adm-zip';
import { Model } from './entities/model.entity';
import { S3Service } from '@shared/services/s3.service';
import { InferenceResultDto } from './dto/inference-result.dto';

@Injectable()
export class InferenceService {
  constructor(
    @InjectRepository(Model)
    private modelsRepository: Repository<Model>,
    private s3Service: S3Service
  ) {}

  async runInference(
    modelId: number,
    imageFile: Express.Multer.File
  ): Promise<InferenceResultDto> {
    const startTime = Date.now();

    // Validate model exists and is completed
    const model = await this.modelsRepository.findOne({ where: { id: modelId } });
    if (!model) {
      throw new NotFoundException(`Model with ID ${modelId} not found`);
    }

    if (model.status !== 'completed') {
      throw new BadRequestException(
        `Model training is not completed. Current status: ${model.status}`
      );
    }

    const imagePath = imageFile.path;
    let outputDir: string | null = null;
    let modelCachePath: string | null = null;

    try {
      // Download model from S3 to cache (if not already cached)
      modelCachePath = path.join(
        process.cwd(),
        'temp',
        'models',
        `model_${modelId}.pth`
      );

      if (!fs.existsSync(modelCachePath)) {
        console.log(`[Inference] Downloading model ${modelId} from S3...`);
        await this.s3Service.downloadFileToDisk(model.s3Key, modelCachePath);
        console.log(`[Inference] Model downloaded to ${modelCachePath}`);
      } else {
        console.log(`[Inference] Using cached model at ${modelCachePath}`);
      }

      // Create unique output directory
      const inferenceId = `inference_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      outputDir = path.join(process.cwd(), 'temp', 'inference', inferenceId);
      fs.mkdirSync(outputDir, { recursive: true });

      // Build model configuration JSON
      const modelConfig = {
        input_channels: model.inputChannels,
        output_channels: model.outputChannels,
        base_filters: model.baseFilters,
        depth: model.depth,
        kernel_size: model.kernelSize,
        num_convs_per_block: model.numConvsPerBlock,
        pooling_type: model.poolingType,
        pooling_size: model.poolingSize,
        upsampling_type: model.upsamplingType,
        upsampling_size: model.upsamplingSize,
        use_batch_norm: model.useBatchNorm,
        activation: model.activation,
        dropout_rate: model.dropoutRate,
        skip_connections: model.skipConnections,
        filter_multiplier: model.filterMultiplier
      };

      // Execute Python inference script
      const pythonScript = path.join(process.cwd(), '..', 'med-seg-ml', 'infer.py');
      const venvPython = path.join(
        process.cwd(),
        '..',
        'med-seg-ml',
        '.venv',
        'bin',
        'python'
      );

      console.log(`[Inference] Running Python inference script...`);

      const args = [
        pythonScript,
        '--model-path',
        modelCachePath,
        '--image-path',
        imagePath,
        '--output-dir',
        outputDir,
        '--config-json',
        JSON.stringify(modelConfig)
      ];

      await this.executePythonScript(venvPython, args);

      // Check for error
      const errorPath = path.join(outputDir, 'error.json');
      if (fs.existsSync(errorPath)) {
        const errorData = JSON.parse(fs.readFileSync(errorPath, 'utf-8'));
        throw new BadRequestException(`Inference failed: ${errorData.message}`);
      }

      // Read output files
      const originalPath = path.join(outputDir, 'original.png');
      const maskPath = path.join(outputDir, 'mask.png');
      const confidencePath = path.join(outputDir, 'confidence.png');
      const metadataPath = path.join(outputDir, 'metadata.json');

      // Verify all files exist
      if (
        !fs.existsSync(originalPath) ||
        !fs.existsSync(maskPath) ||
        !fs.existsSync(confidencePath) ||
        !fs.existsSync(metadataPath)
      ) {
        throw new BadRequestException(
          'Inference completed but output files are missing'
        );
      }

      // Read files and convert to Base64
      const originalBase64 = fs.readFileSync(originalPath, 'base64');
      const maskBase64 = fs.readFileSync(maskPath, 'base64');
      const confidenceBase64 = fs.readFileSync(confidencePath, 'base64');
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

      const inferenceTime = Date.now() - startTime;

      console.log(`[Inference] Completed in ${inferenceTime}ms`);

      // Return result
      return {
        status: 'success',
        modelId: model.id,
        modelName: model.name,
        originalImage: `data:image/png;base64,${originalBase64}`,
        maskImage: `data:image/png;base64,${maskBase64}`,
        confidenceMap: `data:image/png;base64,${confidenceBase64}`,
        metadata: {
          ...metadata,
          inferenceTimeMs: inferenceTime
        }
      };
    } catch (error) {
      console.error(`[Inference] Error:`, error);
      throw error;
    } finally {
      // Clean up temp files
      try {
        if (outputDir && fs.existsSync(outputDir)) {
          fs.rmSync(outputDir, { recursive: true, force: true });
        }
        if (imagePath && fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (cleanupError) {
        console.error(`[Inference] Cleanup error:`, cleanupError);
      }
    }
  }

  async runBatchInference(
    modelId: number,
    zipFile: Express.Multer.File
  ): Promise<{
    results: InferenceResultDto[];
    total: number;
    successful: number;
    failed: number;
  }> {
    const model = await this.modelsRepository.findOne({ where: { id: modelId } });
    if (!model) {
      throw new NotFoundException(`Model with ID ${modelId} not found`);
    }

    if (model.status !== 'completed') {
      throw new BadRequestException(
        `Model training is not completed. Current status: ${model.status}`
      );
    }

    const zipPath = zipFile.path;
    const extractDir = path.join(
      process.cwd(),
      'temp',
      'batch-inference',
      `extract_${Date.now()}`
    );

    try {
      // Extract ZIP file
      console.log(`[Batch Inference] Extracting ZIP file...`);
      fs.mkdirSync(extractDir, { recursive: true });

      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractDir, true);

      // Find all image files
      const imageFiles = this.findImageFiles(extractDir);
      console.log(`[Batch Inference] Found ${imageFiles.length} images`);

      if (imageFiles.length === 0) {
        throw new BadRequestException('No valid image files found in ZIP');
      }

      if (imageFiles.length > 100) {
        throw new BadRequestException('Maximum 100 images allowed per batch');
      }

      // Run inference on each image
      const results: InferenceResultDto[] = [];
      let successful = 0;
      let failed = 0;

      for (const imageFile of imageFiles) {
        try {
          console.log(`[Batch Inference] Processing ${path.basename(imageFile)}...`);

          // Create a fake Multer file object
          const multerFile: Express.Multer.File = {
            path: imageFile,
            originalname: path.basename(imageFile),
            filename: path.basename(imageFile),
            mimetype: this.getMimeType(imageFile),
            size: fs.statSync(imageFile).size,
            fieldname: 'file',
            encoding: '7bit',
            destination: path.dirname(imageFile),
            buffer: Buffer.from([]),
            stream: null as any
          };

          const result = await this.runInference(modelId, multerFile);
          results.push(result);
          successful++;
        } catch (error) {
          console.error(
            `[Batch Inference] Failed to process ${path.basename(imageFile)}:`,
            error.message
          );
          failed++;
          // Continue with next image
        }
      }

      console.log(
        `[Batch Inference] Completed: ${successful} successful, ${failed} failed`
      );

      return {
        results,
        total: imageFiles.length,
        successful,
        failed
      };
    } finally {
      // Clean up
      try {
        if (fs.existsSync(extractDir)) {
          fs.rmSync(extractDir, { recursive: true, force: true });
        }
        if (fs.existsSync(zipPath)) {
          fs.unlinkSync(zipPath);
        }
      } catch (cleanupError) {
        console.error(`[Batch Inference] Cleanup error:`, cleanupError);
      }
    }
  }

  private findImageFiles(dir: string): string[] {
    const imageFiles: string[] = [];
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff'];

    const walk = (currentDir: string) => {
      const files = fs.readdirSync(currentDir);

      for (const file of files) {
        const filePath = path.join(currentDir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          walk(filePath);
        } else if (stat.isFile()) {
          const ext = path.extname(file).toLowerCase();
          if (allowedExtensions.includes(ext)) {
            imageFiles.push(filePath);
          }
        }
      }
    };

    walk(dir);
    return imageFiles;
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private async executePythonScript(
    pythonPath: string,
    args: string[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(pythonPath, args, {
        timeout: 120000 // 2 minutes
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`[Python] ${output.trim()}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.error(`[Python Error] ${output.trim()}`);
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new BadRequestException(
              `Python script failed with code ${code}: ${stderr || stdout}`
            )
          );
        }
      });

      pythonProcess.on('error', (error) => {
        reject(
          new BadRequestException(
            `Failed to execute Python script: ${error.message}`
          )
        );
      });
    });
  }
}
