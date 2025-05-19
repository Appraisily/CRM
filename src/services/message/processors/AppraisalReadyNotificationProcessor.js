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
        sessionId: data.metadata?.sessionId,
        timestamp: data.metadata?.timestamp
      });

      // Validate required data
      if (!data.customer?.email) {
        throw new Error('Customer email is required');
      }

      if (!data.metadata?.sessionId) {
        throw new Error('Session ID is required');
      }

      if (!data.pdf_link) {
        throw new Error('PDF link is required');
      }

      if (!data.wp_link) {
        throw new Error('WordPress link is required');
      }

      // Flags & placeholders
      let userId = null;
      let appraisalId = null;
      let emailInteractionId = null;
      let dbSuccess = false;

      /* --------------------------------------------------
       * Database operations (non-critical)
       * -------------------------------------------------- */
      try {
        // Create or get user
        const userResult = await databaseService.query(
          `INSERT INTO users (email) 
           VALUES ($1)
           ON CONFLICT (email) DO UPDATE 
           SET last_activity = NOW()
           RETURNING id`,
          [data.customer.email]
        );
        userId = userResult.rows[0].id;
        this.logger.info('User record created/updated', { userId });

        // Update appraisal status
        const appraisalUpdateResult = await databaseService.query(
          `UPDATE appraisals 
           SET status = 'completed', completed_at = NOW()
           WHERE session_id = $1
           RETURNING id`,
          [data.metadata.sessionId]
        );
        appraisalId = appraisalUpdateResult.rows.length > 0 ? appraisalUpdateResult.rows[0].id : null;

        dbSuccess = true;
        this.logger.success('Database operations completed');
      } catch (dbError) {
        this.logger.error('Database operations failed – continuing without DB', dbError);
      }

      /* --------------------------------------------------
       * Email operation (critical)
       * -------------------------------------------------- */
      const templateData = {
        customer_name: data.customer.name || 'Customer',
        pdf_link: data.pdf_link,
        wp_link: data.wp_link,
        current_year: new Date().getFullYear().toString()
      };

      const emailResult = await emailService.sendDynamicTemplateEmail(
        data.customer.email,
        process.env.SEND_GRID_TEMPLATE_NOTIFY_APPRAISAL_COMPLETED,
        templateData,
        {
          sessionId: data.metadata.sessionId,
          origin: data.origin || 'system',
          timestamp: data.metadata?.timestamp || new Date().toISOString()
        }
      );
      this.logger.success('Notification email sent', { messageId: emailResult.messageId });

      /* --------------------------------------------------
       * Optional logging of email interaction & activity
       * -------------------------------------------------- */
      if (userId) {
        try {
          const emailInteractionResult = await databaseService.query(
            `INSERT INTO email_interactions 
             (user_id, type, subject, content, status) 
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
              userId,
              'report',
              'Your Appraisal Report is Ready',
              JSON.stringify(templateData),
              'sent'
            ]
          );
          emailInteractionId = emailInteractionResult.rows[0].id;

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
                appraisalId,
                sessionId: data.metadata.sessionId,
                notificationType: 'report_ready',
                timestamp: data.metadata?.timestamp || new Date().toISOString(),
                origin: data.origin || 'system'
              }
            ]
          );
          this.logger.success('Post-email DB logging completed');
        } catch (postDbError) {
          this.logger.error('Post-email DB logging failed – ignoring', postDbError);
        }
      }

      this.logger.success('Appraisal ready notification process finished');
      return {
        success: true,
        dbSuccess,
        userId,
        appraisalId,
        emailInteractionId,
        messageId: emailResult.messageId,
        sessionId: data.metadata.sessionId
      };

    } catch (error) {
      this.logger.error('Failed to fully process appraisal ready notification', error);
      return {
        success: false,
        error: error.message,
        sessionId: data.metadata.sessionId
      };
    }
  }
}

module.exports = AppraisalReadyNotificationProcessor; 