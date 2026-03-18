import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class TestgenResponseDto {
  @Expose() id: string;
  @Expose() targetFile: string;
  @Expose() testFile: string;
  @Expose() content: string;
  @Expose() framework: string;
  @Expose() runId: string | null;
  @Expose() repoId: string | null;
  @Expose() @Type(() => Date) createdAt: Date;
  @Expose() @Type(() => Date) updatedAt: Date;
}
