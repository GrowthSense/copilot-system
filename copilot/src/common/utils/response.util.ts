import { HttpStatus } from '@nestjs/common';
import { ApiResponse, PaginationMeta } from '../interfaces/api-response.interface';
import { PaginatedResult } from '../interfaces/paginated.interface';

export function ok<T>(data: T, message = 'Success'): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    statusCode: HttpStatus.OK,
    timestamp: new Date().toISOString(),
  };
}

export function created<T>(data: T, message = 'Created'): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    statusCode: HttpStatus.CREATED,
    timestamp: new Date().toISOString(),
  };
}

export function paginated<T>(
  result: PaginatedResult<T>,
  message = 'Success',
): ApiResponse<T[]> & { meta: PaginationMeta } {
  const totalPages = Math.ceil(result.total / result.limit);
  return {
    success: true,
    data: result.items,
    message,
    statusCode: HttpStatus.OK,
    timestamp: new Date().toISOString(),
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages,
    },
  };
}
