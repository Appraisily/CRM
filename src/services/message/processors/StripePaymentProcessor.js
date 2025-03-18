const databaseService = require('../../database');
const Logger = require('../../../utils/logger');

class StripePaymentProcessor {
  constructor() {
    this.logger = new Logger('Stripe Payment Processor');
  }

  async process(data) {
    try {
      this.logger.info('Processing Stripe payment', {
        checkoutSessionId: data.payment.checkoutSessionId,
        paymentIntentId: data.payment.paymentIntentId,
        amount: data.payment.amount,
        serviceType: data.payment.metadata.serviceType
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
      
      // Record purchase
      await databaseService.query(
        `INSERT INTO purchases 
         (user_id, service_type, amount, currency, status, payment_method, completed_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          userId,
          data.payment.metadata.serviceType,
          data.payment.amount,
          data.payment.currency,
          data.payment.status,
          'stripe'
        ]
      );

      // Record activity
      await databaseService.query(
        `INSERT INTO user_activities 
         (user_id, activity_type, status, metadata) 
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          'purchase',
          'completed',
          {
            checkoutSessionId: data.payment.checkoutSessionId,
            paymentIntentId: data.payment.paymentIntentId,
            stripeCustomerId: data.customer.stripeCustomerId,
            serviceType: data.payment.metadata.serviceType,
            sessionId: data.payment.metadata.sessionId,
            amount: data.payment.amount,
            currency: data.payment.currency,
            origin: data.metadata.origin,
            environment: data.metadata.environment,
            timestamp: data.metadata.timestamp
          }
        ]
      );

      this.logger.success('Stripe payment processed successfully');
      return {
        success: true,
        checkoutSessionId: data.payment.checkoutSessionId,
        userId
      };

    } catch (error) {
      this.logger.error('Failed to process Stripe payment', error);
      throw error;
    }
  }
}

module.exports = StripePaymentProcessor;