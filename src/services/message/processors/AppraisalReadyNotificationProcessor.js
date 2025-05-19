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
        sessionId: data.sessionId,
        timestamp: data.timestamp
      });

      // Validate required data
      if (!data.customer?.email) {
        throw new Error('Customer email is required');
      }

      if (!data.sessionId) {
        throw new Error('Session ID is required');
      }

      if (!data.pdf_link) {
        throw new Error('PDF link is required');
      }

      if (!data.wp_link) {
        throw new Error('WordPress link is required');
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
         WHERE session_id = $1
         RETURNING id`,
        [data.sessionId]
      );

      // Get appraisal ID if available
      const appraisalId = appraisalUpdateResult.rows.length > 0 
        ? appraisalUpdateResult.rows[0].id 
        : null;

      // Prepare template data
      const templateData = {
        customer_name: data.customer.name || 'Customer',
        pdf_link: data.pdf_link,
        wp_link: data.wp_link,
        current_year: new Date().getFullYear().toString()
      };

      // Send notification email using the template
      const emailResult = await emailService.sendTemplatedEmail({
        to: data.customer.email,
        templateId: process.env.SEND_GRID_TEMPLATE_NOTIFY_APPRAISAL_COMPLETED,
        dynamicTemplateData: templateData,
        metadata: {
          sessionId: data.sessionId,
          origin: data.origin || 'system',
          timestamp: data.timestamp || new Date().toISOString()
        }
      });

      this.logger.info('Notification email sent', { messageId: emailResult.messageId });

      // Record email interaction
      const emailInteractionResult = await databaseService.query(
        `INSERT INTO email_interactions 
         (user_id, type, subject, content, status) 
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          userId,
          'report',
          'Your Appraisal Report is Ready',
          JSON.stringify(templateData), // Store template data as content
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
            appraisalId, // May be null if not found
            sessionId: data.sessionId,
            notificationType: 'report_ready',
            timestamp: data.timestamp || new Date().toISOString(),
            origin: data.origin || 'system'
          }
        ]
      );

      this.logger.success('Appraisal ready notification processed successfully');
      
      return {
        success: true,
        userId,
        appraisalId,
        emailInteractionId,
        messageId: emailResult.messageId,
        sessionId: data.sessionId
      };

    } catch (error) {
      this.logger.error('Failed to process appraisal ready notification', error);
      return {
        success: false,
        error: error.message,
        sessionId: data.sessionId
      };
    }
  }
}

module.exports = AppraisalReadyNotificationProcessor; 