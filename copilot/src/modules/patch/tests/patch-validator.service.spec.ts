import { Test, TestingModule } from '@nestjs/testing';
import { PatchValidatorService } from '../patch-validator.service';
import { ProposePatchOutput } from '../../llm/schemas/propose-patch.schema';
import { GenerateTestsOutput } from '../../llm/schemas/generate-tests.schema';

const validPatch: ProposePatchOutput = {
  title: 'Fix email case sensitivity in login',
  description: 'Normalise email to lower-case before lookup.',
  diff: `--- a/src/auth/auth.service.ts\n+++ b/src/auth/auth.service.ts\n@@ -10,1 +10,1 @@\n-  const user = await this.db.user.findUnique({ where: { email } });\n+  const user = await this.db.user.findUnique({ where: { email: email.toLowerCase() } });`,
  filePaths: ['src/auth/auth.service.ts'],
  riskLevel: 'LOW',
  reasoning: 'Email addresses should be case-insensitive per RFC 5321.',
  testingNotes: 'Test login with mixed-case email. Verify that "User@Example.com" logs in successfully.',
  breakingChanges: false,
};

const validTests: GenerateTestsOutput = {
  testFile: 'src/auth/auth.service.spec.ts',
  content: `describe('AuthService', () => { it('should login with lowercase email', () => { expect(true).toBe(true); }); });`,
  framework: 'jest',
  testCount: 1,
  coveredScenarios: ['login with lowercase email'],
  setupNotes: 'Mock DatabaseService.',
  mockedDependencies: ['DatabaseService'],
};

describe('PatchValidatorService', () => {
  let service: PatchValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PatchValidatorService],
    }).compile();
    service = module.get(PatchValidatorService);
  });

  // ─── validatePatchProposal() ───────────────────────────────────────────────

  describe('validatePatchProposal()', () => {
    it('passes a well-formed patch', () => {
      const result = service.validatePatchProposal(validPatch);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects an empty diff', () => {
      const result = service.validatePatchProposal({ ...validPatch, diff: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
    });

    it('rejects whitespace-only diff', () => {
      const result = service.validatePatchProposal({ ...validPatch, diff: '   \n   ' });
      expect(result.valid).toBe(false);
    });

    it('rejects empty filePaths array', () => {
      const result = service.validatePatchProposal({ ...validPatch, filePaths: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('file path'))).toBe(true);
    });

    it('rejects absolute paths in filePaths', () => {
      const result = service.validatePatchProposal({ ...validPatch, filePaths: ['/etc/passwd'] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Absolute path'))).toBe(true);
    });

    it('rejects path traversal in filePaths', () => {
      const result = service.validatePatchProposal({ ...validPatch, filePaths: ['../../../etc/passwd'] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('traversal'))).toBe(true);
    });

    it('rejects a diff exceeding the size limit', () => {
      const hugeDiff = '--- a/file\n+++ b/file\n' + '+line\n'.repeat(100_000);
      const result = service.validatePatchProposal({ ...validPatch, diff: hugeDiff });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('size'))).toBe(true);
    });

    it('warns when diff lacks --- / +++ headers', () => {
      const result = service.validatePatchProposal({ ...validPatch, diff: 'just some text without diff headers' });
      expect(result.valid).toBe(true); // warning only, not a hard error
      expect(result.warnings.some((w) => w.includes('unified diff format'))).toBe(true);
    });

    it('warns when security-sensitive paths have LOW risk', () => {
      const result = service.validatePatchProposal({
        ...validPatch,
        filePaths: ['src/auth/jwt.strategy.ts'],
        riskLevel: 'LOW',
      });
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('security-sensitive'))).toBe(true);
    });

    it('does not warn about security paths when riskLevel is MEDIUM or above', () => {
      const result = service.validatePatchProposal({
        ...validPatch,
        filePaths: ['src/auth/jwt.strategy.ts'],
        riskLevel: 'MEDIUM',
      });
      expect(result.warnings.every((w) => !w.includes('security-sensitive'))).toBe(true);
    });
  });

  // ─── validateTestOutput() ──────────────────────────────────────────────────

  describe('validateTestOutput()', () => {
    it('passes a well-formed test output', () => {
      const result = service.validateTestOutput(validTests);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects empty content', () => {
      const result = service.validateTestOutput({ ...validTests, content: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
    });

    it('rejects empty testFile', () => {
      const result = service.validateTestOutput({ ...validTests, testFile: '' });
      expect(result.valid).toBe(false);
    });

    it('rejects absolute testFile path', () => {
      const result = service.validateTestOutput({ ...validTests, testFile: '/home/user/tests/foo.spec.ts' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('relative path'))).toBe(true);
    });

    it('rejects path traversal in testFile', () => {
      const result = service.validateTestOutput({ ...validTests, testFile: '../../outside.spec.ts' });
      expect(result.valid).toBe(false);
    });

    it('rejects testFile with no recognised test extension', () => {
      const result = service.validateTestOutput({ ...validTests, testFile: 'src/foo/bar.ts' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('extension'))).toBe(true);
    });

    it('rejects content with no test calls', () => {
      const result = service.validateTestOutput({ ...validTests, content: 'export const x = 1;' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('test calls'))).toBe(true);
    });

    it('rejects testCount of 0', () => {
      const result = service.validateTestOutput({ ...validTests, testCount: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('testCount is 0'))).toBe(true);
    });

    it('warns when declared testCount significantly differs from actual it() count', () => {
      const content = `describe('X', () => { it('a', () => {}); it('b', () => {}); });`;
      const result = service.validateTestOutput({ ...validTests, content, testCount: 10 });
      expect(result.valid).toBe(true); // warning only
      expect(result.warnings.some((w) => w.includes('testCount'))).toBe(true);
    });
  });
});
