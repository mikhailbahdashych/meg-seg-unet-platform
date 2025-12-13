import { Injectable, Logger } from '@nestjs/common';
import { GraphQLClient, gql } from 'graphql-request';
import { CredentialsService } from '@settings/credentials.service';
import { GpuTypeDto } from '../dto/gpu-type.dto';

@Injectable()
export class RunPodGraphQLService {
  private readonly logger = new Logger(RunPodGraphQLService.name);
  private client: GraphQLClient | null = null;
  private readonly RUNPOD_GRAPHQL_ENDPOINT = 'https://api.runpod.io/graphql';

  constructor(private credentialsService: CredentialsService) {}

  private async ensureInitialized(): Promise<void> {
    if (this.client) {
      return;
    }

    const apiKey = await this.credentialsService.getRunpodApiKey();
    if (!apiKey) {
      throw new Error('RunPod API key not configured');
    }

    this.client = new GraphQLClient(this.RUNPOD_GRAPHQL_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    this.logger.log('RunPod GraphQL client initialized');
  }

  async queryGpuTypes(): Promise<GpuTypeDto[]> {
    await this.ensureInitialized();

    const query = gql`
      query GpuTypes {
        gpuTypes {
          id
          displayName
          manufacturer
          memoryInGb
          secureCloud
          communityCloud
          lowestPrice(input: { gpuCount: 1 }) {
            minimumBidPrice
            uninterruptablePrice
          }
        }
      }
    `;

    try {
      const data: any = await this.client!.request(query);

      return data.gpuTypes.map((gpu: any) => ({
        id: gpu.id,
        displayName: gpu.displayName,
        manufacturer: gpu.manufacturer || 'NVIDIA',
        memoryInGb: gpu.memoryInGb,
        secureCloud: gpu.secureCloud,
        communityCloud: gpu.communityCloud,
        uninterruptablePrice: gpu.lowestPrice?.uninterruptablePrice || 0,
        minimumBidPrice: gpu.lowestPrice?.minimumBidPrice || 0,
        stockStatus: 'Available' // Default since API doesn't provide this field
      }));
    } catch (error) {
      this.logger.error(`Error querying GPU types: ${error.message}`, error.stack);
      throw new Error(`Failed to query GPU types: ${error.message}`);
    }
  }

  async deployOnDemandPod(input: {
    gpuTypeId: string;
    name: string;
    imageName?: string;
  }): Promise<any> {
    await this.ensureInitialized();

    const mutation = gql`
      mutation DeployPod($input: PodFindAndDeployOnDemandInput!) {
        podFindAndDeployOnDemand(input: $input) {
          id
          desiredStatus
          imageName
          machine {
            podHostId
          }
          runtime {
            uptimeInSeconds
            ports {
              ip
              isIpPublic
              privatePort
              publicPort
              type
            }
            gpus {
              id
              gpuUtilPercent
              memoryUtilPercent
            }
          }
        }
      }
    `;

    const variables = {
      input: {
        cloudType: 'SECURE',
        gpuCount: 1,
        volumeInGb: 50,
        containerDiskInGb: 20,
        minVcpuCount: 4,
        minMemoryInGb: 16,
        gpuTypeId: input.gpuTypeId,
        name: input.name,
        imageName:
          input.imageName ||
          'runpod/pytorch:2.1.0-py3.10-cuda12.1.1-devel-ubuntu22.04',
        dockerArgs: '',
        ports: '22/tcp',
        volumeMountPath: '/workspace',
        startSsh: true,
        env: [{ key: 'DEBIAN_FRONTEND', value: 'noninteractive' }]
      }
    };

    try {
      const data: any = await this.client!.request(mutation, variables);
      this.logger.log(
        `Pod deployed successfully: ${data.podFindAndDeployOnDemand.id}`
      );
      return data.podFindAndDeployOnDemand;
    } catch (error) {
      this.logger.error(`Error deploying pod: ${error.message}`, error.stack);

      if (error.message.includes('insufficient')) {
        throw new Error(
          'Insufficient RunPod credits. Please add credits to your account.'
        );
      } else if (error.message.includes('availability')) {
        throw new Error(
          'No GPUs available. Try a different GPU type or try again later.'
        );
      }

      throw new Error(`Failed to deploy pod: ${error.message}`);
    }
  }

  async getPodStatus(podId: string): Promise<any> {
    await this.ensureInitialized();

    const query = gql`
      query GetPod($podId: String!) {
        pod(input: { podId: $podId }) {
          id
          desiredStatus
          runtime {
            uptimeInSeconds
            ports {
              ip
              publicPort
              privatePort
              type
            }
            gpus {
              gpuUtilPercent
              memoryUtilPercent
            }
          }
        }
      }
    `;

    try {
      const data: any = await this.client!.request(query, { podId });
      return data.pod;
    } catch (error) {
      this.logger.error(`Error getting pod status: ${error.message}`, error.stack);
      throw new Error(`Failed to get pod status: ${error.message}`);
    }
  }

  async stopPod(podId: string): Promise<void> {
    await this.ensureInitialized();

    const mutation = gql`
      mutation StopPod($podId: String!) {
        podStop(input: { podId: $podId }) {
          id
          desiredStatus
        }
      }
    `;

    try {
      await this.client!.request(mutation, { podId });
      this.logger.log(`Pod stopped: ${podId}`);
    } catch (error) {
      this.logger.error(`Error stopping pod: ${error.message}`, error.stack);
      throw new Error(`Failed to stop pod: ${error.message}`);
    }
  }

  async terminatePod(podId: string): Promise<void> {
    await this.ensureInitialized();

    const mutation = gql`
      mutation TerminatePod($podId: String!) {
        podTerminate(input: { podId: $podId })
      }
    `;

    try {
      await this.client!.request(mutation, { podId });
      this.logger.log(`Pod terminated: ${podId}`);
    } catch (error) {
      this.logger.error(`Error terminating pod: ${error.message}`, error.stack);
      throw new Error(`Failed to terminate pod: ${error.message}`);
    }
  }
}
