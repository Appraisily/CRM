const Logger = require('../../utils/logger');
const ProcessorFactory = require('./processors/ProcessorFactory');
const { 
  validateScreenerNotification,
  validateChatSummary,
  validateGmailInteraction,
  validateAppraisalRequest,
  validateStripePayment,
  validateBulkAppraisalEmailUpdate,
  validateBulkAppraisalFinalized,
  validateResetPasswordRequest,
  validateNewRegistrationEmail
} = require('./validators');
const { ValidationError, ProcessingError } = require('../../utils/errors');

class MessageHandler {
  constructor() {
    this.logger = new Logger('Message Handler');
    this.processorFactory = new ProcessorFactory();
  }

  async handleMessage(message) {
    try {
      this.logger.info('Processing PubSub Message');
      
      // Parse message data
      let data;
      try {
        data = typeof message.data === 'string' ? 
          JSON.parse(message.data) :
          JSON.parse(message.data.toString());

        // Log complete message data
        this.logger.info('Complete message data:', {
          ...data,
          rawData: message.data.toString()
        });

      } catch (parseError) {
        throw new ValidationError(`Failed to parse message data: ${parseError.message}`);
      }
      
      // Validate message content
      let validation;
      
      const validators = {
        screenerNotification: validateScreenerNotification,
        chatSummary: validateChatSummary,
        gmailInteraction: validateGmailInteraction,
        appraisalRequest: validateAppraisalRequest,
        stripePayment: validateStripePayment,
        bulkAppraisalEmailUpdate: validateBulkAppraisalEmailUpdate,
        bulkAppraisalFinalized: validateBulkAppraisalFinalized,
        resetPasswordRequest: validateResetPasswordRequest,
        newRegistrationEmail: validateNewRegistrationEmail
      };

      // Debug logging for validator lookup
      this.logger.info('Validator lookup:', {
        requestedProcess: data.crmProcess,
        availableValidators: Object.keys(validators),
        validatorFound: !!validators[data.crmProcess]
      });

      const validator = validators[data.crmProcess];
      if (!validator) {
        throw new ValidationError(`Unknown crmProcess: ${data.crmProcess}`);
      }

      // Debug logging for validation
      this.logger.info('Running validation for process:', data.crmProcess);

      validation = validator(data);

      // Debug logging for validation result
      this.logger.info('Validation result:', {
        isValid: validation.isValid,
        errors: validation.errors || []
      });
      if (!validation.isValid) {
        throw new ValidationError(`Invalid message format: ${validation.errors.join(', ')}`);
      }

      // Get appropriate processor and process message
      const processor = this.processorFactory.getProcessor(data.crmProcess);
      const result = await processor.process(data);

      if (!result.success) {
        throw new ProcessingError(result.error || 'Processing failed without specific error');
      }

      return result.success;
    } catch (error) {
      this.logger.error('Error processing message', error);
      throw error;
    } finally {
      this.logger.end();
    }
  }
}

module.exports = MessageHandler;