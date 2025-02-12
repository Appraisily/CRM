const databaseService = require('../../database');
const Logger = require('../../../utils/logger');

class AppraisalProcessor {
  constructor() {
    this.logger = new Logger('Appraisal Processor');
  }

  async process(data) {
    try {
      this.logger.info('Processing appraisal request', {
        sessionId: data.appraisal.sessionId,
        serviceType: data.appraisal.serviceType
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
      
      // Record appraisal
      await databaseService.query(
        `INSERT INTO appraisals 
         (id, user_id, session_id, image_url, status, result_summary) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          data.appraisal.sessionId,
          userId,
          data.appraisal.sessionId,
          data.appraisal.images.finalDescription,
          data.appraisal.status,
          {
            serviceType: data.appraisal.serviceType,
            requestDate: data.appraisal.requestDate,
            editLink: data.appraisal.editLink,
            images: data.appraisal.images,
            value: data.appraisal.value,
            documents: data.appraisal.documents,
            publishing: data.appraisal.publishing
          }
        ]
      );

      // Record purchase if status is completed
      if (data.appraisal.status === 'completed') {
        await databaseService.query(
          `INSERT INTO purchases 
           (user_id, service_type, amount, currency, status, completed_at) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            data.appraisal.serviceType,
            data.appraisal.value.amount,
            data.appraisal.value.currency,
            'completed',
            new Date(data.appraisal.requestDate)
          ]
        );
      }

      // Record activity
      await databaseService.query(
        `INSERT INTO user_activities 
         (user_id, activity_type, status, metadata) 
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          'appraisal',
          data.appraisal.status,
          {
            sessionId: data.appraisal.sessionId,
            serviceType: data.appraisal.serviceType,
            requestDate: data.appraisal.requestDate,
            value: data.appraisal.value,
            origin: data.metadata.origin,
            timestamp: data.metadata.timestamp
          }
        ]
      );

      this.logger.success('Appraisal request processed successfully');
      return {
        success: true,
        sessionId: data.appraisal.sessionId,
        userId
      };

    } catch (error) {
      this.logger.error('Failed to process appraisal request', error);
      throw error;
    }
  }
}

module.exports = AppraisalProcessor;