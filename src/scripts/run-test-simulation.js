/**
 * Utility script to test each message type by directly simulating message processing
 * without going through the PubSub system
 */

const { createTestMessageData } = require('./test-data');
const MessageHandler = require('../services/message/handler');
const Logger = require('../utils/logger');

// Use mock database
const mockDb = require('./mock-database');
// Override the real database in the require cache
const dbPath = require.resolve('../services/database');
require.cache[dbPath].exports = mockDb;

const logger = new Logger('Simulator Test');

// Process types we want to test
const processes = [
  'resetPasswordRequest',
  'newRegistrationEmail',
  'screenerNotification',
  'chatSummary',
  'gmailInteraction',
  'appraisalRequest',
  'stripePayment',
  'bulkAppraisalFinalized',
  'bulkAppraisalEmailUpdate'
];

/**
 * Run a simulation for all process types
 */
async function runSimulations() {
  const timestamp = Date.now();
  const results = [];
  
  logger.info('Starting simulation of all message processors');
  const handler = new MessageHandler();
  
  for (const processType of processes) {
    try {
      logger.info(`Simulating ${processType}...`);
      
      // Generate test message data
      const messageData = createTestMessageData(processType, timestamp);
      if (!messageData) {
        results.push({
          processType,
          success: false,
          error: 'Failed to create test message data'
        });
        logger.error(`Failed to create test data for ${processType}`);
        continue;
      }
      
      // Create a fake PubSub message
      const fakeMessage = {
        id: `sim-${timestamp}-${processType}`,
        data: Buffer.from(JSON.stringify(messageData)),
        attributes: { timestamp: new Date(timestamp).toISOString() },
        ack: () => logger.info(`Message acknowledged (simulated) for ${processType}`)
      };
      
      // Process the message
      try {
        const processingResult = await handler.handleMessage(fakeMessage);
        results.push({
          processType,
          success: true,
          result: processingResult
        });
        logger.success(`✓ ${processType} processing succeeded`);
      } catch (error) {
        results.push({
          processType,
          success: false,
          error: error.message || 'Unknown error during processing'
        });
        logger.error(`✗ ${processType} processing failed: ${error.message}`);
        logger.error(error.stack);
      }
    } catch (error) {
      results.push({
        processType,
        success: false,
        error: error.message || 'Unknown error'
      });
      logger.error(`Error simulating ${processType}:`, error);
    }
  }
  
  // Print summary
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  logger.info('Simulation Complete');
  logger.info(`Results: ${successCount} succeeded, ${failureCount} failed`);
  
  if (failureCount > 0) {
    logger.info('Failed simulations:');
    results.filter(r => !r.success).forEach(result => {
      logger.info(`- ${result.processType}: ${result.error}`);
    });
  }
  
  return {
    results,
    successCount,
    failureCount,
    timestamp
  };
}

/**
 * Run a simulation for a specific process type
 */
async function runSingleSimulation(processType) {
  const timestamp = Date.now();
  logger.info(`Starting simulation for ${processType}`);
  
  try {
    const handler = new MessageHandler();
    
    // Generate test message data
    const messageData = createTestMessageData(processType, timestamp);
    if (!messageData) {
      logger.error(`Failed to create test data for ${processType}`);
      return {
        success: false,
        error: 'Failed to create test message data'
      };
    }
    
    // Create a fake PubSub message
    const fakeMessage = {
      id: `sim-${timestamp}-${processType}`,
      data: Buffer.from(JSON.stringify(messageData)),
      attributes: { timestamp: new Date(timestamp).toISOString() },
      ack: () => logger.info(`Message acknowledged (simulated) for ${processType}`)
    };
    
    // Process the message
    logger.info(`Processing message for ${processType}...`, { messageData });
    const processingResult = await handler.handleMessage(fakeMessage);
    
    logger.success(`✓ ${processType} processing succeeded`);
    return {
      success: true,
      processType,
      result: processingResult,
      messageData
    };
  } catch (error) {
    logger.error(`✗ ${processType} processing failed: ${error.message}`);
    logger.error(error.stack);
    return {
      success: false,
      processType,
      error: error.message || 'Unknown error',
      stack: error.stack
    };
  }
}

// Export for reuse in other scripts
module.exports = {
  runSimulations,
  runSingleSimulation
};

// Run directly if called via node
if (require.main === module) {
  const args = process.argv.slice(2);
  const specificProcess = args[0];
  
  if (specificProcess) {
    logger.info(`Simulating specific process: ${specificProcess}`);
    runSingleSimulation(specificProcess)
      .then(result => {
        console.log(JSON.stringify(result, null, 2));
        if (!result.success) {
          process.exit(1);
        }
      })
      .catch(error => {
        console.error('Error running simulation:', error);
        process.exit(1);
      });
  } else {
    runSimulations()
      .then(result => {
        console.log(`Simulation complete: ${result.successCount} succeeded, ${result.failureCount} failed`);
        if (result.failureCount > 0) {
          process.exit(1);
        }
      })
      .catch(error => {
        console.error('Error running simulations:', error);
        process.exit(1);
      });
  }
}