export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message: string;
  statusCode: number;
  timestamp: string;
}

export interface PaginatedApiResponse<T = unknown> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
