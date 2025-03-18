/**
 * Script to validate all message templates and fix any issues
 */

const { validateMessage } = require('./validate-message');
const Logger = require('../utils/logger');

const logger = new Logger('Template Validator');

// List of all process types to test
const processTypes = [
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

async function validateAllTemplates() {
  logger.info('Starting validation of all message templates');
  
  const results = [];
  let allValid = true;
  
  // Test each process type
  for (const processType of processTypes) {
    logger.info(`Testing ${processType}...`);
    
    try {
      const result = await validateMessage(processType);
      results.push(result);
      
      if (!result.success || !result.isValid) {
        allValid = false;
        logger.error(`✗ ${processType} validation failed`);
      } else {
        logger.success(`✓ ${processType} validation passed`);
      }
    } catch (error) {
      logger.error(`Error testing ${processType}:`, error);
      results.push({
        processType,
        success: false,
        error: error.message
      });
      allValid = false;
    }
  }
  
  // Print summary
  logger.info('');
  logger.info('Validation Summary:');
  
  const validCount = results.filter(r => r.success && r.isValid).length;
  const invalidCount = results.length - validCount;
  
  logger.info(`${validCount} of ${results.length} message types are valid`);
  
  if (invalidCount > 0) {
    logger.info('');
    logger.info('Failed validations:');
    results
      .filter(r => !r.success || !r.isValid)
      .forEach(result => {
        const errors = result.errors || (result.error ? [result.error] : ['Unknown error']);
        logger.error(`✗ ${result.processType}: ${errors.join(', ')}`);
      });
  }
  
  return {
    allValid,
    results,
    validCount,
    invalidCount
  };
}

// Run the script
validateAllTemplates()
  .then(result => {
    if (result.allValid) {
      logger.success('All message templates are valid!');
    } else {
      logger.error('Some message templates failed validation. Please check the logs above.');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('Error running validation:', error);
    process.exit(1);
  });