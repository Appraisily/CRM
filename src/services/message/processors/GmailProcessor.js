const databaseService = require('../../database');
const Logger = require('../../../utils/logger');

class GmailProcessor {
  constructor() {
    this.logger = new Logger('Gmail Processor');
  }

  async process(data) {
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
      
      // Determine the appropriate email status based on our enum values
      // Valid values in schema: 'sent', 'delivered', 'opened', 'clicked', 'replied'
      // For incoming emails, 'replied' is most appropriate
      const emailStatus = 'replied';
      
      // Determine email type more precisely if possible
      // Valid values: 'inquiry', 'support', 'report', 'offer'
      let emailType = 'inquiry'; // Default
      
      // Simple classification based on subject keywords
      const subjectLower = data.email.subject.toLowerCase();
      if (subjectLower.includes('help') || subjectLower.includes('support') || subjectLower.includes('assistance')) {
        emailType = 'support';
      } else if (subjectLower.includes('report') || subjectLower.includes('issue')) {
        emailType = 'report';
      } else if (subjectLower.includes('offer') || subjectLower.includes('quote') || subjectLower.includes('price')) {
        emailType = 'offer';
      }
      
      // Record email interaction
      const emailResult = await databaseService.query(
        `INSERT INTO email_interactions 
         (user_id, type, subject, content, status) 
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          userId,
          emailType,
          data.email.subject,
          data.email.content,
          emailStatus
        ]
      );
      
      const emailInteractionId = emailResult.rows[0].id;

      // Prepare rich metadata for better tracking
      const metadata = {
        messageId: data.email.messageId,
        threadId: data.email.threadId,
        emailInteractionId: emailInteractionId,
        classification: data.email.classification || null,
        attachments: data.email.attachments || [],
        response: data.email.response || null,
        labels: data.metadata.labels || [],
        processingTime: data.metadata.processingTime,
        timestamp: data.metadata.timestamp,
        source: 'gmail'
      };

      // Record activity
      await databaseService.query(
        `INSERT INTO user_activities 
         (user_id, activity_type, status, metadata) 
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          'email',
          'completed',
          metadata
        ]
      );

      this.logger.success('Gmail interaction processed successfully');
      return {
        success: true,
        messageId: data.email.messageId,
        userId,
        emailInteractionId
      };

    } catch (error) {
      this.logger.error('Failed to process Gmail interaction', error);
      throw error;
    }
  }
}

module.exports = GmailProcessor;