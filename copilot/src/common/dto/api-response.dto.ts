import { Exclude, Expose } from 'class-transformer';
import { ApiResponse, PaginationMeta } from '../interfaces/api-response.interface';

@Exclude()
export class ApiResponseDto<T = unknown> implements ApiResponse<T> {
  @Expose()
  success: boolean;

  @Expose()
  data: T | null;

  @Expose()
  message: string;

  @Expose()
  statusCode: number;

  @Expose()
  timestamp: string;

  constructor(partial: Partial<ApiResponseDto<T>>) {
    Object.assign(this, partial);
  }
}

@Exclude()
export class PaginatedResponseDto<T = unknown> {
  @Expose()
  success: boolean;

  @Expose()
  data: T[];

  @Expose()
  message: string;

  @Expose()
  statusCode: number;

  @Expose()
  timestamp: string;

  @Expose()
  meta: PaginationMeta;

  constructor(partial: Partial<PaginatedResponseDto<T>>) {
    Object.assign(this, partial);
  }
}
