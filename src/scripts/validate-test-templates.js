/**
 * Utility script to validate all test message templates against their validators.
 * This helps ensure that our test data will pass validation when used in tests.
 */

const validators = require('../services/message/validators');
const { createTestMessageData } = require('./test-data');
const Logger = require('../utils/logger');

const logger = new Logger('Validator Test');

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

async function validateTemplates() {
  const timestamp = Date.now();
  const results = [];
  
  logger.info('Starting validation of test message templates');
  
  for (const processType of processes) {
    try {
      logger.info(`Validating ${processType}...`);
      
      // Generate test message data
      const messageData = createTestMessageData(processType, timestamp);
      if (!messageData) {
        results.push({
          processType,
          isValid: false,
          error: 'Failed to create test message data'
        });
        logger.error(`Failed to create test data for ${processType}`);
        continue;
      }
      
      // Find the appropriate validator
      const validatorName = `validate${processType.charAt(0).toUpperCase() + processType.slice(1)}`;
      const validator = validators[validatorName];
      
      if (!validator || typeof validator !== 'function') {
        results.push({
          processType,
          isValid: false,
          error: `No validator found (${validatorName})`
        });
        logger.error(`No validator found for ${processType} (${validatorName})`);
        continue;
      }
      
      // Run validation
      const validation = validator(messageData);
      
      results.push({
        processType,
        isValid: validation.isValid,
        errors: validation.errors || [],
        messageData: validation.isValid ? undefined : messageData // Only include data if invalid
      });
      
      if (validation.isValid) {
        logger.success(`✓ ${processType} validation passed`);
      } else {
        logger.error(`✗ ${processType} validation failed: ${validation.errors.join(', ')}`);
      }
    } catch (error) {
      results.push({
        processType,
        isValid: false,
        error: error.message || 'Unknown error'
      });
      logger.error(`Error validating ${processType}:`, error);
    }
  }
  
  // Print summary
  const validCount = results.filter(r => r.isValid).length;
  const invalidCount = results.filter(r => !r.isValid).length;
  
  logger.info('Validation Complete');
  logger.info(`Results: ${validCount} passed, ${invalidCount} failed`);
  
  if (invalidCount > 0) {
    logger.info('Failed validations:');
    results.filter(r => !r.isValid).forEach(result => {
      logger.info(`- ${result.processType}: ${result.error || result.errors.join(', ')}`);
    });
  }
  
  return {
    results,
    validCount,
    invalidCount,
    timestamp
  };
}


// Export for reuse in other scripts
module.exports = {
  validateTemplates
};

// Run directly if called via node
if (require.main === module) {
  validateTemplates()
    .then(result => {
      console.log(`Validation complete: ${result.validCount} passed, ${result.invalidCount} failed`);
      
      // Exit with error code if any validations failed
      if (result.invalidCount > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Error running validation:', error);
      process.exit(1);
    });
}