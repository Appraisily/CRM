export class AppError extends Error {
  code: string;
  constructor(message: string, code?: string);
}

export class ValidationError extends AppError {
  constructor(message: string);
}

export class ProcessingError extends AppError {
  constructor(message: string);
}

export class InitializationError extends AppError {
  constructor(message: string);
} 