const databaseService = require('../database');
const Logger = require('../../utils/logger');

class GmailProcessor {
  constructor() {
    this.logger = new Logger('Gmail Processor');
  }

  async processGmailInteraction(data) {
    try {
      this.logger.info('Processing Gmail interaction', {
        messageId: data.email.messageId,
        threadId: data.email.threadId
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
      
      // Record email interaction
      await databaseService.query(
        `INSERT INTO email_interactions 
         (user_id, type, subject, content, status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'inquiry',
          data.email.subject,
          data.email.content,
          'received'
        ]
      );

      // Record activity
      await databaseService.query(
        `INSERT INTO user_activities 
         (user_id, activity_type, status, metadata) 
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          'email',
          'completed',
          {
            messageId: data.email.messageId,
            threadId: data.email.threadId,
            classification: data.email.classification,
            attachments: data.email.attachments,
            response: data.email.response,
            labels: data.metadata.labels,
            processingTime: data.metadata.processingTime,
            timestamp: data.metadata.timestamp
          }
        ]
      );

      this.logger.success('Gmail interaction processed successfully');
      return {
        success: true,
        messageId: data.email.messageId,
        userId
      };

    } catch (error) {
      this.logger.error('Failed to process Gmail interaction', error);
      throw error;
    }
  }
}

module.exports = new GmailProcessor();