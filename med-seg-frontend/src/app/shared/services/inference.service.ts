import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';

export interface InferenceResult {
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

export interface BatchInferenceResult {
  results: InferenceResult[];
  total: number;
  successful: number;
  failed: number;
}

@Injectable({
  providedIn: 'root'
})
export class InferenceService {
  private apiUrl = `${environment.apiUrl}/models`;

  constructor(private http: HttpClient) {}

  runInference(modelId: number, imageFile: File): Observable<InferenceResult> {
    const formData = new FormData();
    formData.append('file', imageFile);

    return this.http.post<InferenceResult>(
      `${this.apiUrl}/${modelId}/infer`,
      formData
    );
  }

  runBatchInference(
    modelId: number,
    zipFile: File
  ): Observable<BatchInferenceResult> {
    const formData = new FormData();
    formData.append('file', zipFile);

    return this.http.post<BatchInferenceResult>(
      `${this.apiUrl}/${modelId}/infer-batch`,
      formData
    );
  }
}
