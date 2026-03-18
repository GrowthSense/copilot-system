import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileReadAttempt } from './interfaces/repo-index.interface';

/** Extensions that are always treated as binary without reading content. */
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'tiff',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'mp3', 'mp4', 'avi', 'mov', 'wmv', 'flac', 'wav', 'ogg',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'tar', 'gz', 'bz2', 'rar', '7z', 'xz',
  'exe', 'dll', 'so', 'dylib', 'bin', 'o', 'a',
  'class', 'pyc', 'pyo', 'pyd',
  'db', 'sqlite', 'sqlite3',
  'jar', 'war', 'ear',
  'img', 'iso', 'dmg',
  'psd', 'ai', 'sketch',
]);

const DEFAULT_MAX_FILE_SIZE_BYTES = 512 * 1024; // 512 KB
const BINARY_CHECK_BYTES = 8192;

@Injectable()
export class FileReaderService {
  private readonly logger = new Logger(FileReaderService.name);

  /**
   * Safely read a text file from an absolute path.
   *
   * Guards applied (in order):
   * 1. Path traversal — resolved path must start with resolved repo root.
   * 2. File size — skips files exceeding `maxSizeBytes`.
   * 3. Known binary extension — skips without reading content.
   * 4. Null-byte scan — skips if the first 8 KB contains a null byte.
   */
  async readFile(
    absolutePath: string,
    repoRoot: string,
    maxSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
  ): Promise<FileReadAttempt> {
    const resolvedPath = path.resolve(absolutePath);
    const resolvedRoot = path.resolve(repoRoot);

    if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
      throw new Error(
        `Path traversal attempt: "${absolutePath}" resolves outside repo root "${repoRoot}"`,
      );
    }

    let statResult: Awaited<ReturnType<typeof fs.stat>>;
    try {
      statResult = await fs.stat(resolvedPath);
    } catch {
      return { isBinary: true, reason: 'unreadable', sizeBytes: 0 };
    }

    if (statResult.size > maxSizeBytes) {
      return { isBinary: true, reason: 'too_large', sizeBytes: statResult.size };
    }

    const ext = path.extname(resolvedPath).toLowerCase().replace('.', '');
    if (BINARY_EXTENSIONS.has(ext)) {
      return { isBinary: true, reason: 'binary', sizeBytes: statResult.size };
    }

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(resolvedPath);
    } catch {
      return { isBinary: true, reason: 'unreadable', sizeBytes: statResult.size };
    }

    // Null-byte scan to detect binary content not covered by extension check.
    const scanLength = Math.min(buffer.length, BINARY_CHECK_BYTES);
    for (let i = 0; i < scanLength; i++) {
      if (buffer[i] === 0) {
        return { isBinary: true, reason: 'binary', sizeBytes: statResult.size };
      }
    }

    const content = buffer.toString('utf-8');
    const lineCount = content.split('\n').length;

    return { isBinary: false, content, lineCount, sizeBytes: statResult.size };
  }

  /** Returns true when the path exists and is a directory. */
  async isDirectory(absolutePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(absolutePath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Recursively lists all file paths under `baseDir`.
   * Returns paths relative to `baseDir` using the OS path separator.
   */
  async listFilesRecursively(baseDir: string): Promise<string[]> {
    const results: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true }) as unknown as typeof entries;
      } catch {
        this.logger.warn(`Cannot read directory: ${dir}`);
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          // Normalise to forward slashes for consistent cross-platform storage.
          results.push(path.relative(baseDir, fullPath).split(path.sep).join('/'));
        }
      }
    };

    await walk(baseDir);
    return results;
  }
}
