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
  // For testing purposes, allow "test" as a fallback if env var isn't set
  if (apiKey !== (process.env.TEST_HANDLERS_API_KEY || "test")) {
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
const testHandlerRoute: RequestHandler = async (req, res, next) => {
  const process = req.query.process as string | undefined;
  const timestamp = Date.now();

  try {
    // Add a clear marker in logs for test requests
    console.log(`[TEST HANDLER] Running test for process: ${process || 'all'}`);

    // If specific process requested, test only that one
    if (process) {
      const message = createTestMessage(process, timestamp);
      if (!message) {
        res.status(400).json({ error: `Unknown process type: ${process}` });
        return;
      }

      const processor = processorFactory.getProcessor(process);
      const result = await processor.process(message as Message);
      res.json({ success: true, process, result });
      return;
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

    res.json({ success: true, results });
  } catch (error) {
    console.error('[TEST HANDLER] Error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
};

router.post('/test-handlers', testHandlerRoute);

// Create a mock Message class that implements ack() and nack() methods
class MockMessage {
  data: Buffer;
  
  constructor(data: any) {
    this.data = Buffer.from(JSON.stringify(data));
  }
  
  ack(): Promise<void> {
    console.log('Message acknowledged');
    return Promise.resolve();
  }
  
  nack(): Promise<void> {
    console.log('Message not acknowledged');
    return Promise.resolve();
  }
}

function createTestMessage(processType: string, timestamp: number): any {
  // Base message data with test marker
  const baseData = {
    customer: { 
      email: TEST_EMAIL,
      isTestMessage: true // Marker to identify test messages
    },
    metadata: { 
      timestamp,
      isTest: true,
      environment: 'production-test'
    }
  };

  let messageData;
  
  switch (processType) {
    case 'resetPasswordRequest':
      messageData = {
        ...baseData,
        crmProcess: processType,
        token: `test-token-${timestamp}`
      };
      break;

    case 'newRegistrationEmail':
      messageData = {
        ...baseData,
        crmProcess: processType
      };
      break;

    case 'bulkAppraisalEmailUpdate':
      messageData = {
        ...baseData,
        crmProcess: processType,
        metadata: {
          ...baseData.metadata,
          sessionId: `test-session-${timestamp}`,
          origin: 'test',
          environment: 'test'
        }
      };
      break;

    case 'screenerNotification':
      messageData = {
        ...baseData,
        crmProcess: processType,
        sessionId: `test-session-${timestamp}`,
        metadata: {
          ...baseData.metadata,
          imageUrl: 'https://example.com/test-image.jpg'
        }
      };
      break;
      
    case 'chatSummary':
    case 'gmailInteraction':
    case 'appraisalRequest':
    case 'stripePayment':
    case 'bulkAppraisalFinalized':
      messageData = {
        ...baseData,
        crmProcess: processType
      };
      break;

    default:
      return null;
  }
  
  // Return a mock Message object with ack() and nack() methods
  return new MockMessage(messageData);
}

export default router; 