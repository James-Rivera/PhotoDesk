export type BackgroundRemovalStage = "connecting" | "uploading" | "runtime" | "model" | "processing" | "finishing";

export interface BackgroundRemovalProgress {
  stage: BackgroundRemovalStage;
  percent: number;
  message: string;
}

export interface BackgroundRemovalProvider {
  readonly id: string;
  readonly name: string;
  remove(file: File, onProgress: (progress: BackgroundRemovalProgress) => void, options?: { signal?: AbortSignal }): Promise<Blob>;
}

export interface BackgroundRemovalHealth {
  status: "ready" | "starting" | "offline" | "unconfigured";
  model?: string;
  serviceVersion?: string;
}
