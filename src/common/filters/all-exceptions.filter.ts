import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const body = this.toErrorBody(exception);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json({
      ...body,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private toErrorBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message ?? exception.message);
      return { statusCode: status, error: HttpStatus[status] ?? 'Error', message };
    }

    // Violacion de indice unico en Mongo (por ejemplo correo duplicado)
    if (this.isDuplicateKey(exception)) {
      const fields = Object.keys(exception.keyValue ?? {}).join(', ');
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'CONFLICT',
        message: `Ya existe un registro con el mismo valor en: ${fields}`,
      };
    }

    if (exception instanceof MongooseError.ValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'BAD_REQUEST',
        message: Object.values(exception.errors).map((e) => e.message),
      };
    }

    if (exception instanceof MongooseError.CastError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'BAD_REQUEST',
        message: `Valor invalido para '${exception.path}'`,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Error interno del servidor',
    };
  }

  private isDuplicateKey(
    exception: unknown,
  ): exception is { code: number; keyValue?: Record<string, unknown> } {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      (exception as { code?: number }).code === 11000
    );
  }
}
