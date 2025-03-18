/**
 * Command-line tool to validate a specific message type against its validator
 */

const { createTestMessageData } = require('./test-data');
const validators = require('../services/message/validators');
const Logger = require('../utils/logger');

const logger = new Logger('Message Validator');

/**
 * Validate a test message for a specific process type
 * @param {string} processType The type of message to validate
 * @param {object} customData Optional custom data to use instead of generated test data
 * @returns {object} Validation result
 */
async function validateMessage(processType, customData = null) {
  const timestamp = Date.now();
  
  try {
    logger.info(`Validating message for process: ${processType}`);
    
    // Generate or use provided test message data
    const messageData = customData || createTestMessageData(processType, timestamp);
    if (!messageData) {
      logger.error(`Failed to create test data for ${processType}`);
      return {
        success: false,
        error: 'Failed to create test message data'
      };
    }
    
    logger.info(`Message data:`, { messageData });
    
    // Find the appropriate validator
    const validatorName = `validate${processType.charAt(0).toUpperCase() + processType.slice(1)}`;
    const validator = validators[validatorName];
    
    if (!validator || typeof validator !== 'function') {
      logger.error(`No validator found for ${processType} (${validatorName})`);
      return {
        success: false,
        error: `No validator found (${validatorName})`,
        availableValidators: Object.keys(validators)
          .filter(key => key.startsWith('validate'))
          .map(key => key.replace('validate', ''))
      };
    }
    
    // Run validation
    const validation = validator(messageData);
    
    if (validation.isValid) {
      logger.success(`✓ ${processType} validation passed`);
    } else {
      logger.error(`✗ ${processType} validation failed: ${validation.errors.join(', ')}`);
    }
    
    return {
      success: true,
      processType,
      isValid: validation.isValid,
      errors: validation.errors || [],
      messageData
    };
  } catch (error) {
    logger.error(`Error validating ${processType}:`, error);
    return {
      success: false,
      processType,
      error: error.message || 'Unknown error',
      stack: error.stack
    };
  }
}

// Run directly if called via node
if (require.main === module) {
  const args = process.argv.slice(2);
  const processType = args[0];
  
  if (!processType) {
    console.error('Please specify a process type to validate');
    console.log('Usage: node validate-message.js <processType>');
    console.log('Example: node validate-message.js gmailInteraction');
    process.exit(1);
  }
  
  validateMessage(processType)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.success || (result.isValid === false)) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = { validateMessage };