import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { AppError, ErrorKind } from '../../domain/errors';

const status: Record<ErrorKind, number> = {
  validation: 400,
  conflict: 409,
  not_found: 404,
  unauthorized: 401,
  forbidden: 403,
  rate_limit: 429,
};
@Catch(AppError)
export class AppErrorFilter implements ExceptionFilter<AppError> {
  catch(error: AppError, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status[error.kind])
      .json({ statusCode: status[error.kind], message: error.message });
  }
}
