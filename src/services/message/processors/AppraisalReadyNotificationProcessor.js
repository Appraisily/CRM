const databaseService = require('../../database');
const emailService = require('../../email');
const Logger = require('../../../utils/logger');

class AppraisalReadyNotificationProcessor {
  constructor() {
    this.logger = new Logger('Appraisal Ready Notification Processor');
  }

  async process(data) {
    try {
      this.logger.info('Processing appraisal ready notification', {
        appraisalId: data.appraisal.id,
        sessionId: data.appraisal.sessionId,
        timestamp: data.metadata?.timestamp
      });

      // Validate required data
      if (!data.customer?.email) {
        throw new Error('Customer email is required');
      }

      if (!data.appraisal?.id) {
        throw new Error('Appraisal ID is required');
      }

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
      this.logger.info('User record created/updated', { userId });

      // Update appraisal status to completed if it exists in our database
      const appraisalUpdateResult = await databaseService.query(
        `UPDATE appraisals 
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1 OR session_id = $2
         RETURNING id`,
        [
          data.appraisal.id,
          data.appraisal.sessionId
        ]
      );

      // Send notification email
      const emailParams = {
        customer: data.customer,
        appraisal: {
          id: data.appraisal.id,
          sessionId: data.appraisal.sessionId,
          reportUrl: data.appraisal.reportUrl || this._generateReportUrl(data.appraisal.id),
          type: data.appraisal.type || 'standard',
          itemDescription: data.appraisal.itemDescription || '',
          estimatedValue: data.appraisal.estimatedValue || '',
          completedDate: data.appraisal.completedDate || new Date().toISOString(),
          imageUrl: data.appraisal.imageUrl || ''
        },
        metadata: {
          origin: data.metadata?.origin || 'system',
          environment: data.metadata?.environment || 'production',
          timestamp: data.metadata?.timestamp || new Date().toISOString()
        }
      };

      const emailResult = await emailService.sendAppraisalReadyNotification(emailParams);
      this.logger.info('Notification email sent', { messageId: emailResult.messageId });

      // Record email interaction
      const emailInteractionResult = await databaseService.query(
        `INSERT INTO email_interactions 
         (user_id, type, subject, content, status) 
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          userId,
          'report', // Using the enum value that fits best (report)
          emailResult.subject || 'Your Appraisal Report is Ready',
          emailResult.content || 'Your appraisal report is now available to view.',
          'sent'
        ]
      );
      
      const emailInteractionId = emailInteractionResult.rows[0].id;

      // Record user activity
      await databaseService.query(
        `INSERT INTO user_activities 
         (user_id, activity_type, status, metadata) 
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          'appraisal', 
          'completed',
          {
            emailInteractionId,
            appraisalId: data.appraisal.id,
            sessionId: data.appraisal.sessionId,
            notificationType: 'report_ready',
            timestamp: data.metadata?.timestamp || new Date().toISOString(),
            origin: data.metadata?.origin || 'system',
            environment: data.metadata?.environment || 'production'
          }
        ]
      );

      this.logger.success('Appraisal ready notification processed successfully');
      
      return {
        success: true,
        userId,
        appraisalId: data.appraisal.id,
        emailInteractionId,
        messageId: emailResult.messageId,
        sessionId: data.appraisal.sessionId
      };

    } catch (error) {
      this.logger.error('Failed to process appraisal ready notification', error);
      return {
        success: false,
        error: error.message,
        appraisalId: data.appraisal?.id,
        sessionId: data.appraisal?.sessionId
      };
    }
  }

  // Helper to generate a report URL if not provided
  _generateReportUrl(appraisalId) {
    return `https://dashboard.example.com/appraisals/${appraisalId}/report`;
  }
}

module.exports = AppraisalReadyNotificationProcessor; 