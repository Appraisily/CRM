declare class Logger {
  constructor(context: string);
  info(message: string, data?: any): void;
  error(message: string, error?: any): void;
  success(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  end(): void;
}

export = Logger; 