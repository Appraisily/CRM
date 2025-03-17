import express, { Request, Response, NextFunction } from 'express';
import { ProcessorFactory } from '../services/message/processors/ProcessorFactory';

const router = express.Router();
const TEST_EMAIL = 'ratonxi@gmail.com';
const processorFactory = new ProcessorFactory();

// Middleware to ensure only authorized access
const ensureAuthorized = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'];
  // Only allow access with a specific test API key
  if (apiKey !== process.env.TEST_HANDLERS_API_KEY) {
    res.status(403).json({ error: 'Unauthorized access to test handlers' });
    return;
  }
  next();
};

router.use(ensureAuthorized);

// Test handlers endpoint
router.post('/test-handlers', async (req: Request, res: Response) => {
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
      const result = await processor.process(message);
      return res.json({ success: true, process, result });
    }

    // Test all handlers
    const results = [];
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
        const result = await processor.process(message);
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
});

function createTestMessage(processType: string, timestamp: number): any {
  // Add a test marker to all messages
  const baseMessage = {
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

  switch (processType) {
    case 'resetPasswordRequest':
      return {
        ...baseMessage,
        crmProcess: processType,
        token: `test-token-${timestamp}`
      };

    case 'newRegistrationEmail':
      return {
        ...baseMessage,
        crmProcess: processType
      };

    case 'bulkAppraisalEmailUpdate':
      return {
        ...baseMessage,
        crmProcess: processType,
        metadata: {
          ...baseMessage.metadata,
          sessionId: `test-session-${timestamp}`,
          origin: 'test',
          environment: 'test'
        }
      };

    case 'screenerNotification':
      return {
        ...baseMessage,
        crmProcess: processType,
        sessionId: `test-session-${timestamp}`,
        metadata: {
          ...baseMessage.metadata,
          imageUrl: 'https://example.com/test-image.jpg'
        }
      };

    // Add other message types as needed...

    default:
      return null;
  }
}

export default router; 