export class InferenceResultDto {
  status: string;
  modelId: number;
  modelName: string;
  originalImage: string; // Base64 data URI
  maskImage: string; // Base64 data URI
  confidenceMap: string; // Base64 data URI
  metadata: {
    originalSize: number[]; // [width, height]
    inferenceTimeMs: number;
    meanConfidence: number;
    maxConfidence: number;
    minConfidence: number;
  };
}
