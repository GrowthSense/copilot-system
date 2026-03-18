import { Injectable, Logger } from '@nestjs/common';
import { ProposePatchOutput } from '../llm/schemas/propose-patch.schema';
import { GenerateTestsOutput } from '../llm/schemas/generate-tests.schema';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  /** Non-fatal warnings that don't block persistence but should be logged. */
  warnings: string[];
}

/** Paths whose presence in a diff should trigger minimum MEDIUM risk. */
const SECURITY_SENSITIVE_PATTERNS = [
  'auth',
  'jwt',
  'token',
  'password',
  'secret',
  'crypto',
  'payment',
  'billing',
  'webhook',
];

const MAX_DIFF_BYTES = 500_000;
const VALID_TEST_EXTENSIONS = ['.spec.ts', '.test.ts', '.spec.js', '.test.js', '.spec.tsx', '.test.tsx'];

@Injectable()
export class PatchValidatorService {
  private readonly logger = new Logger(PatchValidatorService.name);

  /**
   * Validate a `ProposePatchOutput` produced by the LLM.
   *
   * Hard rejections (valid=false):
   *  - Empty diff
   *  - No file paths
   *  - Absolute paths in filePaths (security)
   *  - Path traversal (`..`) in filePaths
   *  - Diff exceeds size limit
   *
   * Warnings (valid=true but flagged):
   *  - Diff lacks `---`/`+++` headers (may not be proper unified diff)
   *  - Security-sensitive paths present but riskLevel is LOW
   */
  validatePatchProposal(output: ProposePatchOutput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ── Hard checks ───────────────────────────────────────────────────────────

    if (!output.diff || output.diff.trim().length === 0) {
      errors.push('Patch diff is empty. The LLM did not produce any changes.');
    }

    if (!output.filePaths || output.filePaths.length === 0) {
      errors.push('Patch contains no file paths. At least one file must be identified.');
    } else {
      for (const fp of output.filePaths) {
        if (fp.startsWith('/')) {
          errors.push(`Absolute path detected in filePaths: "${fp}". Only relative paths are allowed.`);
        }
        if (fp.includes('..')) {
          errors.push(`Path traversal detected in filePaths: "${fp}". Paths must not contain "..".`);
        }
      }
    }

    if (output.diff && Buffer.byteLength(output.diff, 'utf-8') > MAX_DIFF_BYTES) {
      errors.push(
        `Diff size (${Buffer.byteLength(output.diff, 'utf-8')} bytes) exceeds the ` +
          `limit of ${MAX_DIFF_BYTES} bytes. Split the patch into smaller changes.`,
      );
    }

    // ── Warnings ──────────────────────────────────────────────────────────────

    if (
      output.diff &&
      (!output.diff.includes('---') || !output.diff.includes('+++'))
    ) {
      warnings.push(
        'Diff does not appear to be in standard unified diff format (missing --- / +++ headers). ' +
          'The patch may not apply cleanly.',
      );
    }

    if (output.filePaths && output.riskLevel === 'LOW') {
      const sensitiveMatches = output.filePaths.filter((fp) =>
        SECURITY_SENSITIVE_PATTERNS.some((pattern) => fp.toLowerCase().includes(pattern)),
      );
      if (sensitiveMatches.length > 0) {
        warnings.push(
          `Files touch security-sensitive paths (${sensitiveMatches.join(', ')}) but riskLevel is LOW. ` +
            'Review the risk assessment carefully.',
        );
      }
    }

    if (errors.length > 0) {
      this.logger.warn(
        `[PatchValidator] Patch validation FAILED with ${errors.length} error(s): ${errors.join('; ')}`,
      );
    } else if (warnings.length > 0) {
      this.logger.warn(
        `[PatchValidator] Patch validation passed with ${warnings.length} warning(s): ${warnings.join('; ')}`,
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a `GenerateTestsOutput` produced by the LLM.
   *
   * Hard rejections:
   *  - Empty content
   *  - Empty or invalid testFile path
   *  - Content has no recognisable test calls (it/test/describe)
   *  - testCount is zero
   *
   * Warnings:
   *  - testCount does not match the number of `it(` or `test(` calls in content
   */
  validateTestOutput(output: GenerateTestsOutput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!output.content || output.content.trim().length === 0) {
      errors.push('Generated test content is empty.');
    }

    if (!output.testFile || output.testFile.trim().length === 0) {
      errors.push('Generated test file path is empty.');
    } else {
      if (output.testFile.startsWith('/')) {
        errors.push(`testFile must be a relative path. Got: "${output.testFile}".`);
      }
      if (output.testFile.includes('..')) {
        errors.push(`Path traversal detected in testFile: "${output.testFile}".`);
      }
      const hasValidExt = VALID_TEST_EXTENSIONS.some((ext) => output.testFile.endsWith(ext));
      if (!hasValidExt) {
        errors.push(
          `testFile "${output.testFile}" does not have a recognised test extension ` +
            `(${VALID_TEST_EXTENSIONS.join(', ')}).`,
        );
      }
    }

    if (output.content) {
      const hasTestCalls =
        output.content.includes('it(') ||
        output.content.includes('test(') ||
        output.content.includes('describe(');
      if (!hasTestCalls) {
        errors.push(
          'Generated content does not contain any recognisable test calls (it/test/describe). ' +
            'The file may not be a valid test.',
        );
      }
    }

    if (output.testCount === 0) {
      errors.push('testCount is 0. The LLM did not generate any test cases.');
    }

    // Warn when the declared testCount doesn't match actual it() count.
    if (output.content && output.testCount > 0) {
      const itMatches = (output.content.match(/\bit\s*\(/g) ?? []).length;
      const testMatches = (output.content.match(/\btest\s*\(/g) ?? []).length;
      const actualCount = itMatches + testMatches;
      if (actualCount > 0 && Math.abs(actualCount - output.testCount) > 2) {
        warnings.push(
          `Declared testCount (${output.testCount}) differs from the number of it()/test() calls ` +
            `found in content (${actualCount}). This may indicate incomplete generation.`,
        );
      }
    }

    if (errors.length > 0) {
      this.logger.warn(
        `[PatchValidator] Test validation FAILED with ${errors.length} error(s): ${errors.join('; ')}`,
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
