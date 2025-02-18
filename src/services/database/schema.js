const Logger = require('../../utils/logger');

class SchemaManager {
  constructor(pool) {
    this.pool = pool;
    this.logger = new Logger('Schema Manager');
  }

  async checkAndApplySchema() {
    try {
      this.logger.info('Checking database schema...');
      const { rows } = await this.pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      
      this.logger.info('Database tables found:', {
        tableCount: rows.length,
        tables: rows.map(row => row.table_name)
      });

      const requiredTables = [
        'users',
        'user_activities',
        'chat_sessions',
        'purchases',
        'appraisals',
        'email_interactions',
        'bulk_appraisals',
        'bulk_appraisal_items'
      ];

      const missingTables = requiredTables.filter(table => 
        !rows.find(row => row.table_name === table)
      );

      if (missingTables.length > 0) {
        await this.applySchema(missingTables);
      } else {
        this.logger.success('All required tables present');
      }
    } catch (error) {
      this.logger.error('Schema check failed', error);
      throw error;
    }
  }

  async applySchema(missingTables) {
    this.logger.info('Applying schema for missing tables:', { missing: missingTables });
    
    try {
      await this.pool.query(require('./sql/schema.sql'));
      this.logger.success('Schema applied successfully');

      // Verify tables were created
      const { rows: updatedRows } = await this.pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);

      const stillMissing = missingTables.filter(table => 
        !updatedRows.find(row => row.table_name === table)
      );

      if (stillMissing.length > 0) {
        throw new Error(`Failed to create tables: ${stillMissing.join(', ')}`);
      }

      this.logger.success('All required tables created successfully');
    } catch (error) {
      this.logger.error('Failed to apply schema', error);
      throw error;
    }
  }
}

module.exports = SchemaManager;