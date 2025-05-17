const emailService = require('../../email');
const databaseService = require('../../database');
const Logger = require('../../../utils/logger');

class ScreenerProcessor {
  constructor() {
    this.logger = new Logger('Screener Processor');
  }

  async process(data) {
    try {
      this.logger.info('Processing screener notification', {
        sessionId: data.sessionId,
        timestamp: data.timestamp
      });

      // Track database activities
      let userId = null;
      
      // Only create user if we have an email
      if (data.customer && data.customer.email) {
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
      }

      // Record the screener activity
      const activityMetadata = {
        sessionId: data.sessionId,
        timestamp: data.timestamp,
        origin: data.origin || null,
        environment: data.metadata?.environment || null,
        screenType: data.metadata?.screenType || 'standard',
        source: 'screener'
      };

      if (userId) {
        // If we have a user, associate the activity with them
        await databaseService.query(
          `INSERT INTO user_activities 
           (user_id, activity_type, status, metadata) 
           VALUES ($1, $2, $3, $4)`,
          [
            userId,
            'website_visit', // Using the enum value that fits best
            'completed',
            activityMetadata
          ]
        );
        this.logger.info('Screener activity recorded for user', { userId });
      } else {
        // For anonymous screeners, just log it
        this.logger.info('Anonymous screener activity', activityMetadata);
      }

      // Call email service to handle the notification
      const emailResult = await emailService.handleScreenerNotification({
        customer: data.customer,
        sessionId: data.sessionId,
        metadata: data.metadata,
        timestamp: data.timestamp,
        origin: data.origin
      });

      // If email was sent and we have a user, track the email interaction
      if (emailResult.emailSent && userId) {
        await databaseService.query(
          `INSERT INTO email_interactions 
           (user_id, type, subject, content, status) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            'support', // Using the appropriate email_type
            emailResult.subject || 'Screener Notification',
            emailResult.content || 'Automated screener notification email',
            'sent'
          ]
        );
        this.logger.info('Email interaction recorded');
      }

      this.logger.success('Screener notification processed successfully');
      
      // Return enriched result
      return {
        ...emailResult,
        userId,
        activityRecorded: !!userId
      };

    } catch (error) {
      this.logger.error('Failed to process screener notification', error);
      throw error;
    }
  }
}

module.exports = ScreenerProcessor;