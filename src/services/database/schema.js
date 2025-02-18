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

      // Find missing tables
      const missingTables = expectedTables.filter(table => !existingTables.includes(table));

      if (missingTables.length > 0) {
        this.logger.info('Applying schema for missing tables:', {
          missing: missingTables
        });

        await this.applySchema();
      } else {
        this.logger.info('All required tables exist');
      }

      return true;
    } catch (error) {
      this.logger.error('Schema check failed', error);
      throw error;
    }
  }

  async applySchema() {
    try {
      const schemaPath = path.join(__dirname, 'sql', 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');

      await this.pool.query(schema);
      this.logger.success('Schema applied successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to apply schema', error);
      throw error;
    }
  }
}

module.exports = SchemaManager;