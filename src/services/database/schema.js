const fs = require('fs');
const path = require('path');
const Logger = require('../../utils/logger');

class SchemaManager {
  constructor(pool) {
    this.pool = pool;
    this.logger = new Logger('Schema Manager');
  }

  async checkAndApplySchema() {
    try {
      this.logger.info('Checking database schema...');

      // Get list of existing tables
      const { rows } = await this.pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);

      const existingTables = rows.map(row => row.table_name);
      
      this.logger.info('Database tables found:', {
        tableCount: existingTables.length,
        tables: existingTables
      });

      // Define expected tables
      const expectedTables = [
        'users',
        'user_activities',
        'chat_sessions',
        'purchases',
        'appraisals',
        'email_interactions',
        'bulk_appraisals',
        'bulk_appraisal_items'
      ];

      // Check if any expected tables are missing
      const missingTables = expectedTables.filter(table => !existingTables.includes(table));

      if (missingTables.length > 0) {
        this.logger.warn('Some expected tables are missing:', {
          missing: missingTables,
          message: 'Tables must be created manually. See documentation.'
        });
        
        // Log instead of applying schema automatically
        this.logger.info('DATABASE MIGRATION NOTICE: Schema changes must be applied manually. Please refer to the README.md and supabase/migrations/DO_NOT_RUN.md files for database management instructions.');
      } else {
        this.logger.success('All required tables exist');
      }

      return true;
    } catch (error) {
      this.logger.error('Schema check failed', error);
      throw error;
    }
  }

  // This method is kept for reference but will no longer be used
  async applySchema() {
    this.logger.warn('AUTOMATIC SCHEMA APPLICATION IS DISABLED');
    this.logger.info('Please connect to the database manually and apply any necessary changes');
    this.logger.info('See README.md and supabase/migrations/DO_NOT_RUN.md for instructions');
    return false;
  }
}

module.exports = SchemaManager;