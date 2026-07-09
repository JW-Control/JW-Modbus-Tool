export interface SaveSessionFileRequest {
  filePath?: string | null;
  defaultFileName?: string;
  data: unknown;
}

export interface SaveSessionFileResult {
  canceled: boolean;
  filePath?: string;
  bytesWritten?: number;
}

export interface OpenSessionFileRequest {
  filePath?: string | null;
}

export interface OpenSessionFileResult {
  canceled: boolean;
  filePath?: string;
  data?: unknown;
}
