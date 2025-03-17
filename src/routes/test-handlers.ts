import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { ProcessorFactory } from '../services/message/processors/ProcessorFactory';
import { Message } from '@google-cloud/pubsub';

const router = express.Router();
const TEST_EMAIL = 'ratonxi@gmail.com';
const processorFactory = new ProcessorFactory();

// Middleware to ensure only authorized access
const ensureAuthorized: RequestHandler = (req, res, next): void => {
  const apiKey = req.headers['x-api-key'];
  // Only allow access with a specific test API key
  if (apiKey !== process.env.TEST_HANDLERS_API_KEY) {
    res.status(403).json({ error: 'Unauthorized access to test handlers' });
    return;
  }
  next();
};

router.use(ensureAuthorized);

interface TestResult {
  process: string;
  success: boolean;
  result?: any;
  error?: string;
}

// Test handlers endpoint
const testHandlerRoute: RequestHandler = async (req, res) => {
  const process = req.query.process as string | undefined;
  const timestamp = Date.now();

  try {
    // Add a clear marker in logs for test requests
    console.log(`[TEST HANDLER] Running test for process: ${process || 'all'}`);

    // If specific process requested, test only that one
    if (process) {
      const message = createTestMessage(process, timestamp);
      if (!message) {
        return res.status(400).json({ error: `Unknown process type: ${process}` });
      }

      const processor = processorFactory.getProcessor(process);
      const result = await processor.process(message as Message);
      return res.json({ success: true, process, result });
    }

    // Test all handlers
    const results: TestResult[] = [];
    const processes = [
      'resetPasswordRequest',
      'newRegistrationEmail',
      'screenerNotification',
      'chatSummary',
      'gmailInteraction',
      'appraisalRequest',
      'stripePayment',
      'bulkAppraisalFinalized'
    ];

    for (const processType of processes) {
      try {
        const message = createTestMessage(processType, timestamp);
        const processor = processorFactory.getProcessor(processType);
        const result = await processor.process(message as Message);
        results.push({ process: processType, success: true, result });
      } catch (error) {
        results.push({ 
          process: processType, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return res.json({ success: true, results });
  } catch (error) {
    console.error('[TEST HANDLER] Error:', error instanceof Error ? error.message : 'Unknown error');
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
};

router.post('/test-handlers', testHandlerRoute);

function createTestMessage(processType: string, timestamp: number): any {
  // Add a test marker to all messages
  const baseMessage = {
    data: Buffer.from(JSON.stringify({
      customer: { 
        email: TEST_EMAIL,
        isTestMessage: true // Marker to identify test messages
      },
      metadata: { 
        timestamp,
        isTest: true,
        environment: 'production-test'
      }
    }))
  };

  switch (processType) {
    case 'resetPasswordRequest':
      return {
        ...baseMessage,
        data: Buffer.from(JSON.stringify({
          ...JSON.parse(baseMessage.data.toString()),
          crmProcess: processType,
          token: `test-token-${timestamp}`
        }))
      };

    case 'newRegistrationEmail':
      return {
        ...baseMessage,
        data: Buffer.from(JSON.stringify({
          ...JSON.parse(baseMessage.data.toString()),
          crmProcess: processType
        }))
      };

    case 'bulkAppraisalEmailUpdate':
      return {
        ...baseMessage,
        data: Buffer.from(JSON.stringify({
          ...JSON.parse(baseMessage.data.toString()),
          crmProcess: processType,
          metadata: {
            ...JSON.parse(baseMessage.data.toString()).metadata,
            sessionId: `test-session-${timestamp}`,
            origin: 'test',
            environment: 'test'
          }
        }))
      };

    case 'screenerNotification':
      return {
        ...baseMessage,
        data: Buffer.from(JSON.stringify({
          ...JSON.parse(baseMessage.data.toString()),
          crmProcess: processType,
          sessionId: `test-session-${timestamp}`,
          metadata: {
            ...JSON.parse(baseMessage.data.toString()).metadata,
            imageUrl: 'https://example.com/test-image.jpg'
          }
        }))
      };

    // Add other message types as needed...

    default:
      return null;
  }
}

export default router; 