export interface SaveTextFileRequest {
  /** Text written now (for a data log: the CSV header). */
  text: string;
  defaultFileName: string;
  /** e.g. [{ name: "CSV", extensions: ["csv"] }] */
  filters?: Array<{ name: string; extensions: string[] }>;
  title?: string;
}

export interface SaveTextFileResult {
  canceled: boolean;
  filePath?: string;
  bytesWritten?: number;
}

export interface AppendTextFileRequest {
  /** Must be a path returned by `saveText` in this run of the app. */
  filePath: string;
  text: string;
}
