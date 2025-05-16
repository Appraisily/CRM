const Logger = require('../../../utils/logger');
const sheetsService = require('../../sheets');
const databaseService = require('../../database');
const emailService = require('../../email');

class BulkAppraisalEmailProcessor {
  constructor() {
    this.logger = new Logger('Bulk Appraisal Email Processor');
  }

  async process(data) {
    try {
      this.logger.info('Processing bulk appraisal email update', {
        sessionId: data.metadata.sessionId,
        timestamp: data.metadata.timestamp,
        email: data.customer.email,
        origin: data.metadata.origin,
        environment: data.metadata.environment
      });

      let result = {
        success: false,
        dbSuccess: false,
        sheetSuccess: false,
        emailSuccess: false,
        userId: null,
        sessionId: data.metadata.sessionId,
        timestamp: data.metadata.timestamp
      };

      // Create or get user
      try {
        this.logger.info('Attempting database operations...');
        const userResult = await databaseService.query(
          `INSERT INTO users (email) 
           VALUES ($1)
           ON CONFLICT (email) DO UPDATE 
           SET last_activity = NOW()
           RETURNING id`,
          [data.customer.email]
        );
        
        const userId = userResult.rows[0].id;
        this.logger.info('User record created/updated', { userId });
        result.userId = userId;

        // Create initial bulk appraisal record
        this.logger.info('Creating bulk appraisal record...');
        await databaseService.query(
          `INSERT INTO bulk_appraisals 
           (user_id, session_id, appraisal_type, status, total_price, final_price) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            data.metadata.sessionId,
            'regular', // Default type, will be updated during finalization
            'draft',
            0, // Initial price, will be updated during finalization
            0  // Initial final price, will be updated during finalization
          ]
        );
        this.logger.info('Bulk appraisal record created');

        // Record activity
        this.logger.info('Recording user activity...');
        await databaseService.query(
          `INSERT INTO user_activities 
           (user_id, activity_type, status, metadata) 
           VALUES ($1, $2, $3, $4)`,
          [
            userId,
            'appraisal',
            'started',
            {
              type: 'bulk',
              sessionId: data.metadata.sessionId,
              origin: data.metadata.origin,
              environment: data.metadata.environment,
              timestamp: data.metadata.timestamp
            }
          ]
        );
        this.logger.info('User activity recorded');

        result.dbSuccess = true;
        this.logger.success('Database operations completed successfully');
      } catch (dbError) {
        this.logger.error('Database operations failed:', {
          error: dbError.message,
          code: dbError.code,
          detail: dbError.detail,
          hint: dbError.hint,
          position: dbError.position,
          where: dbError.where
        });
      }

      // Log the email submission to the Bulk Appraisals sheet independently
      try {
        this.logger.info('Logging to sheets...');
        await sheetsService.logBulkAppraisalEmail(
          data.metadata.sessionId,
          data.customer.email,
          data.metadata.timestamp
        );
        result.sheetSuccess = true;
        this.logger.success('Sheet logging completed successfully');
      } catch (sheetError) {
        this.logger.error('Sheet logging failed:', sheetError);
        // Don't retry sheet operations - we'll consider this a non-critical error
        // The recovery email can help the user re-engage later
        result.sheetError = {
          message: sheetError.message,
          stack: sheetError.stack
        };
      }

      // Send recovery email independently
      try {
        this.logger.info('Sending recovery email...');
        await emailService.sendBulkAppraisalRecovery(
          data.customer.email,
          data.metadata.sessionId
        );
        result.emailSuccess = true;
        this.logger.success('Recovery email sent successfully');
      } catch (emailError) {
        this.logger.error('Recovery email sending failed:', {
          error: emailError.message,
          response: emailError.response?.body,
          code: emailError.code,
          statusCode: emailError.statusCode
        });
      }

      // Overall success if either database or sheet operation succeeded
      result.success = result.dbSuccess || result.sheetSuccess || result.emailSuccess;
      
      if (result.success) {
        this.logger.success('Bulk appraisal email processing completed with partial or full success');
      } else {
        this.logger.error('All operations failed');
      }

      return result;

    } catch (error) {
      this.logger.error('Failed to process bulk appraisal email update', error);
      return {
        success: false,
        error: error.message,
        dbSuccess: false,
        sheetSuccess: false,
        emailSuccess: false,
        sessionId: data.metadata.sessionId
      };
    }
  }
}

module.exports = BulkAppraisalEmailProcessor;