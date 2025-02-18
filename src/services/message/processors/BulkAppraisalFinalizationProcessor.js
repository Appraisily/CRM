const Logger = require('../../../utils/logger');
const sheetsService = require('../../sheets');
const databaseService = require('../../database');

class BulkAppraisalFinalizationProcessor {
  constructor() {
    this.logger = new Logger('Bulk Appraisal Finalization Processor');
  }

  async process(data) {
    try {
      this.logger.info('Processing bulk appraisal finalization', {
        sessionId: data.appraisal.sessionId,
        type: data.appraisal.type,
        itemCount: data.appraisal.itemCount
      });

      // Get user ID
      const userResult = await databaseService.query(
        `SELECT id FROM users WHERE email = $1`,
        [data.customer.email]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error(`User not found for email: ${data.customer.email}`);
      }
      
      const userId = userResult.rows[0].id;
      
      // Update bulk appraisal record
      await databaseService.query(
        `UPDATE bulk_appraisals 
         SET appraisal_type = $1,
             status = 'pending_payment',
             updated_at = NOW()
         WHERE session_id = $2 AND user_id = $3
         RETURNING id`,
        [
          data.appraisal.type,
          data.appraisal.sessionId,
          userId
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
          'completed',
          {
            type: 'bulk_finalization',
            sessionId: data.appraisal.sessionId,
            appraisalType: data.appraisal.type,
            itemCount: data.appraisal.itemCount,
            customerNotes: data.customer.notes,
            origin: data.metadata.origin,
            environment: data.metadata.environment,
            timestamp: data.metadata.timestamp
          }
        ]
      );

      // Update sheet status
      await sheetsService.logBulkAppraisalEmail(
        data.appraisal.sessionId,
        data.customer.email,
        data.metadata.timestamp
      );

      this.logger.success('Bulk appraisal finalization processed successfully');

      return {
        success: true,
        sessionId: data.appraisal.sessionId,
        userId,
        status: 'pending_payment'
      };

    } catch (error) {
      this.logger.error('Failed to process bulk appraisal finalization', error);
      throw error;
    }
  }
}

module.exports = BulkAppraisalFinalizationProcessor;