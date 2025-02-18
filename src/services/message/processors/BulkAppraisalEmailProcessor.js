const Logger = require('../../../utils/logger');
const sheetsService = require('../../sheets');
const databaseService = require('../../database');

class BulkAppraisalEmailProcessor {
  constructor() {
    this.logger = new Logger('Bulk Appraisal Email Processor');
  }

  async process(data) {
    try {
      this.logger.info('Processing bulk appraisal email update', {
        sessionId: data.metadata.sessionId,
        timestamp: data.metadata.timestamp
      });

      // Create or get user
      const userResult = await databaseService.query(
        `INSERT INTO users (email) 
         VALUES ($1)
         ON CONFLICT (email) DO UPDATE 
         SET last_activity = NOW()
         RETURNING id`,
        [data.customer.email]
      );
      
      const userId = userResult.rows[0].id;
      
      // Create initial bulk appraisal record
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

      // Record activity
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

      // Log the email submission to the Bulk Appraisals sheet
      await sheetsService.logBulkAppraisalEmail(
        data.metadata.sessionId,
        data.customer.email,
        data.metadata.timestamp
      );

      this.logger.success('Bulk appraisal email logged successfully');

      return {
        success: true,
        sessionId: data.metadata.sessionId,
        userId,
        timestamp: data.metadata.timestamp,
        status: 'draft'
      };

    } catch (error) {
      this.logger.error('Failed to process bulk appraisal email update', error);
      throw error;
    }
  }
}

module.exports = BulkAppraisalEmailProcessor;