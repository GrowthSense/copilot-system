import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class RepoResponseDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() fullName: string;
  @Expose() cloneUrl: string;
  @Expose() defaultBranch: string;
  @Expose() description: string | null;
  @Expose() isActive: boolean;
  @Expose() @Type(() => Date) createdAt: Date;
  @Expose() @Type(() => Date) updatedAt: Date;
}
