import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly code?: string,
  ) {
    super({ message, code, statusCode }, statusCode);
  }
}

export class ResourceNotFoundException extends AppException {
  constructor(resource: string, identifier: string) {
    super(
      `${resource} with identifier "${identifier}" was not found`,
      HttpStatus.NOT_FOUND,
      'RESOURCE_NOT_FOUND',
    );
  }
}

export class ValidationException extends AppException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR');
  }
}

export class ConflictException extends AppException {
  constructor(message: string) {
    super(message, HttpStatus.CONFLICT, 'CONFLICT');
  }
}

export class ExternalServiceException extends AppException {
  constructor(service: string, detail: string) {
    super(
      `External service error [${service}]: ${detail}`,
      HttpStatus.BAD_GATEWAY,
      'EXTERNAL_SERVICE_ERROR',
    );
  }
}
