export class ReadFileResponseDto {
  fileId: string;
  repoId: string;
  filePath: string;
  fileName: string;
  language: string | null;
  sizeBytes: number;
  lineCount: number;
  content: string;
}
