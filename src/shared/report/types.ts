export interface CopyMarkdownReportResult {
  characters: number;
}

export interface SaveMarkdownReportRequest {
  markdown: string;
  defaultFileName?: string;
}

export interface SaveMarkdownReportResult {
  canceled: boolean;
  filePath?: string;
  bytesWritten?: number;
}
