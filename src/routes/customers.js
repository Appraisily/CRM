const express = require('express');
const { rateLimit } = require('express-rate-limit');
const databaseService = require('../services/database');
const { validateApiKey } = require('../middleware/auth');
const Logger = require('../utils/logger');

const router = express.Router();
const logger = new Logger('Customer API');

// Rate limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

// Apply rate limiting and API key validation to all routes
router.use(limiter);
router.use(validateApiKey);

// Get customer profile
router.get('/:email', async (req, res) => {
  try {
    const { email } = req.params;
    logger.info(`Fetching profile for ${email}`);

    const result = await databaseService.query(`
      SELECT 
        u.id,
        u.email,
        u.created_at,
        u.last_activity,
        COUNT(DISTINCT p.id) as total_purchases,
        COALESCE(SUM(p.amount), 0) as total_spent,
        COUNT(DISTINCT a.id) as total_appraisals,
        COUNT(DISTINCT c.id) as total_chats,
        COUNT(DISTINCT e.id) as total_emails
      FROM users u
      LEFT JOIN purchases p ON p.user_id = u.id
      LEFT JOIN appraisals a ON a.user_id = u.id
      LEFT JOIN chat_sessions c ON c.user_id = u.id
      LEFT JOIN email_interactions e ON e.user_id = u.id
      WHERE u.email = $1
      GROUP BY u.id
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    logger.success('Profile fetched successfully');
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching customer profile', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer profile'
    });
  }
});

// Get customer activities
router.get('/:email/activities', async (req, res) => {
  try {
    const { email } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    logger.info(`Fetching activities for ${email}`);

    const result = await databaseService.query(`
      SELECT ua.*
      FROM user_activities ua
      JOIN users u ON u.id = ua.user_id
      WHERE u.email = $1
      ORDER BY ua.created_at DESC
      LIMIT $2 OFFSET $3
    `, [email, limit, offset]);

    logger.success('Activities fetched successfully');
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error('Error fetching customer activities', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer activities'
    });
  }
});

// Get customer purchases
router.get('/:email/purchases', async (req, res) => {
  try {
    const { email } = req.params;
    logger.info(`Fetching purchases for ${email}`);

    const result = await databaseService.query(`
      SELECT p.*
      FROM purchases p
      JOIN users u ON u.id = p.user_id
      WHERE u.email = $1
      ORDER BY p.created_at DESC
    `, [email]);

    logger.success('Purchases fetched successfully');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching customer purchases', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer purchases'
    });
  }
});

// Get customer appraisals
router.get('/:email/appraisals', async (req, res) => {
  try {
    const { email } = req.params;
    logger.info(`Fetching appraisals for ${email}`);

    const result = await databaseService.query(`
      SELECT a.*
      FROM appraisals a
      JOIN users u ON u.id = a.user_id
      WHERE u.email = $1
      ORDER BY a.created_at DESC
    `, [email]);

    logger.success('Appraisals fetched successfully');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching customer appraisals', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer appraisals'
    });
  }
});

module.exports = router;