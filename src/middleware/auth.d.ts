import { Request, Response, NextFunction } from 'express';

export interface ServiceInfo {
  name: string;
  permissions: string[];
}

declare function validateApiKey(req: Request, res: Response, next: NextFunction): Promise<void>;

export { validateApiKey }; 