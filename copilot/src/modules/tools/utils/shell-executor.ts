import { spawn } from 'child_process';
import * as path from 'path';

export interface ShellRunOptions {
  /** Must be one of the allowlisted executables. */
  executable: 'npm' | 'yarn' | 'pnpm' | 'npx';
  /** Arguments passed directly to `spawn` — never interpolated into a shell string. */
  args: string[];
  /** Absolute working directory. Must be pre-validated as safe by the caller. */
  cwd: string;
  /** Milliseconds before SIGTERM is sent. Default: 120 000. Hard max: 300 000. */
  timeoutMs?: number;
  /** Maximum combined stdout+stderr bytes retained. Default: 256 KB. */
  maxOutputBytes?: number;
}

export interface ShellRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  command: string;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const HARD_MAX_TIMEOUT_MS = 300_000;
const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024;

/**
 * Executes a shell command from an allowlisted set of executables.
 *
 * Security properties:
 * - Uses `spawn` with `shell: false` — no shell metacharacter injection.
 * - Executable must be in the hard-coded allowlist.
 * - Working directory is validated by the caller (must be within repo root).
 * - Stdout/stderr is truncated at `maxOutputBytes`.
 * - Hard timeout enforced via SIGTERM + SIGKILL after 2 s.
 */
export async function runShellCommand(options: ShellRunOptions): Promise<ShellRunResult> {
  const {
    executable,
    args,
    cwd,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  } = options;

  const clampedTimeout = Math.min(timeoutMs, HARD_MAX_TIMEOUT_MS);
  const commandDisplay = `${executable} ${args.join(' ')}`;

  return new Promise((resolve) => {
    const start = Date.now();
    let stdoutBuf = '';
    let stderrBuf = '';
    let totalBytes = 0;
    let timedOut = false;

    const child = spawn(executable, args, {
      cwd,
      shell: false,
      env: {
        ...process.env,
        // Prevent interactive prompts from blocking.
        CI: 'true',
        FORCE_COLOR: '0',
      },
    });

    const appendOutput = (chunk: Buffer, target: 'out' | 'err') => {
      const remaining = maxOutputBytes - totalBytes;
      if (remaining <= 0) return;
      const str = chunk.toString('utf-8').slice(0, remaining);
      totalBytes += str.length;
      if (target === 'out') stdoutBuf += str;
      else stderrBuf += str;
    };

    child.stdout.on('data', (chunk: Buffer) => appendOutput(chunk, 'out'));
    child.stderr.on('data', (chunk: Buffer) => appendOutput(chunk, 'err'));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      // Force-kill after 2 s if SIGTERM is not enough.
      setTimeout(() => child.kill('SIGKILL'), 2000);
    }, clampedTimeout);

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      const durationMs = Date.now() - start;

      if (totalBytes >= maxOutputBytes) {
        const truncMsg = `\n\n[Output truncated at ${maxOutputBytes} bytes]`;
        if (stdoutBuf.length > 0) stdoutBuf += truncMsg;
        else stderrBuf += truncMsg;
      }

      resolve({
        exitCode: timedOut ? 124 : (exitCode ?? 1),
        stdout: stdoutBuf,
        stderr: stderrBuf,
        durationMs,
        timedOut,
        command: commandDisplay,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout: '',
        stderr: err.message,
        durationMs: Date.now() - start,
        timedOut: false,
        command: commandDisplay,
      });
    });
  });
}

/**
 * Validates that `dir` is within `repoRoot` to prevent working-directory
 * escape attacks (e.g. passing `/etc` as the working directory).
 */
export function assertWithinRepoRoot(dir: string, repoRoot: string): void {
  const resolved = path.resolve(dir);
  const resolvedRoot = path.resolve(repoRoot);

  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    throw new Error(
      `Working directory "${dir}" is outside the repository root "${repoRoot}". ` +
        `Only paths within the indexed repository are permitted.`,
    );
  }
}
