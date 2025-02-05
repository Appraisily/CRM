class AppError extends Error {
  constructor(message, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

class ProcessingError extends AppError {
  constructor(message) {
    super(message, 'PROCESSING_ERROR');
    this.name = 'ProcessingError';
  }
}

class InitializationError extends AppError {
  constructor(message) {
    super(message, 'INITIALIZATION_ERROR');
    this.name = 'InitializationError';
  }
}

module.exports = {
  AppError,
  ValidationError,
  ProcessingError,
  InitializationError
};