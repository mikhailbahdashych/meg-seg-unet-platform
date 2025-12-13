export class GpuTypeDto {
  id: string;
  displayName: string;
  manufacturer: string;
  memoryInGb: number;
  secureCloud: boolean;
  communityCloud: boolean;
  uninterruptablePrice: number;
  minimumBidPrice: number;
  stockStatus: string;
  recommended?: boolean;
}
