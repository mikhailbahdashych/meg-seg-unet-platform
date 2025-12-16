import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RunPodTemplate {
  id: string;
  name: string;
  imageName: string;
  dockerArgs?: string;
  containerDiskInGb?: number;
  volumeInGb?: number;
  volumeMountPath?: string;
  env?: Array<{ key: string; value: string }>;
  ports?: string;
  isRunpod?: boolean;
  isPublic?: boolean;
  category?: string;
}

@Injectable()
export class RunPodTemplatesService {
  private readonly logger = new Logger(RunPodTemplatesService.name);
  private readonly REST_API_URL = 'https://rest.runpod.io/v1';
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RUNPOD_API_KEY') || '';
  }

  async getTemplates(
    includeRunpodTemplates: boolean = true,
    includePublicTemplates: boolean = false,
    includeEndpointBoundTemplates: boolean = false
  ): Promise<RunPodTemplate[]> {
    if (!this.apiKey) {
      this.logger.warn('RunPod API key not configured');
      return [];
    }

    try {
      this.logger.log('Fetching templates from RunPod REST API...');

      const params = new URLSearchParams();
      if (includeRunpodTemplates) params.append('includeRunpodTemplates', 'true');
      if (includePublicTemplates) params.append('includePublicTemplates', 'true');
      if (includeEndpointBoundTemplates)
        params.append('includeEndpointBoundTemplates', 'true');

      const url = `${this.REST_API_URL}/templates?${params.toString()}`;
      this.logger.log(`Fetching from: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(
          `RunPod API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      this.logger.log(`Fetched ${data.length || 0} templates from RunPod`);

      // Filter templates to only show ones with UV or PyTorch
      const filteredTemplates = (data as RunPodTemplate[]).filter((template) => {
        const imageName = template.imageName?.toLowerCase() || '';
        return (
          imageName.includes('pytorch') ||
          imageName.includes('python') ||
          imageName.includes('cuda')
        );
      });

      this.logger.log(
        `Filtered to ${filteredTemplates.length} PyTorch/Python templates`
      );

      return filteredTemplates;
    } catch (error) {
      this.logger.error(`Error fetching templates: ${error.message}`, error.stack);
      return [];
    }
  }

  async getTemplate(templateId: string): Promise<RunPodTemplate | null> {
    if (!this.apiKey) {
      this.logger.warn('RunPod API key not configured');
      return null;
    }

    try {
      this.logger.log(`Fetching template ${templateId} from RunPod REST API...`);

      const response = await fetch(`${this.REST_API_URL}/templates/${templateId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(
          `RunPod API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data as RunPodTemplate;
    } catch (error) {
      this.logger.error(
        `Error fetching template ${templateId}: ${error.message}`,
        error.stack
      );
      return null;
    }
  }
}
