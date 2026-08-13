export type BackgroundRemovalStage = "runtime" | "model" | "processing" | "finishing";

export interface BackgroundRemovalProgress {
  stage: BackgroundRemovalStage;
  percent: number;
  message: string;
}

export interface BackgroundRemovalProvider {
  readonly id: string;
  readonly name: string;
  remove(file: File, onProgress: (progress: BackgroundRemovalProgress) => void): Promise<Blob>;
}
