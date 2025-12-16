export interface Template {
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
