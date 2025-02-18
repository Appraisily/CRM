const { Pool } = require('pg');
const Logger = require('../utils/logger');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const PROJECT_ID = 'civil-forge-403609';

class DatabaseService {
  constructor() {
    this.pool = null;
    this.logger = new Logger('Database Service');
    this.secretClient = new SecretManagerServiceClient();
  }

  async initialize() {
    try {
      this.logger.info('Initializing database connection');
      this.logger.info('Database configuration:', {
        user: process.env.DB_USER || 'postgres',
        database: process.env.DB_NAME || 'appraisily_activity_db',
        socketPath: process.env.DB_SOCKET_PATH || '/cloudsql',
        instanceName: process.env.INSTANCE_CONNECTION_NAME || 'Not provided'
      });
      this.logger.info('Database configuration:', {
        user: process.env.DB_USER || 'postgres',
        database: process.env.DB_NAME || 'appraisily_activity_db',
        socketPath: process.env.DB_SOCKET_PATH || '/cloudsql',
        instanceName: process.env.INSTANCE_CONNECTION_NAME || 'Not provided'
      });
      
      // Get database password from Secret Manager
      this.logger.info('Retrieving database password from Secret Manager');
      const name = `projects/${PROJECT_ID}/secrets/DB_PASSWORD/versions/latest`;
      const [version] = await this.secretClient.accessSecretVersion({ name });
      const dbPassword = version.payload.data.toString('utf8');

      // Get database connection details from environment
      const instanceUnixSocket = process.env.DB_SOCKET_PATH || '/cloudsql';
      const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;
      
      this.logger.info('Connection details:', {
        instanceUnixSocket,
        instanceConnectionName,
        hasPassword: !!dbPassword
      });

      if (!instanceConnectionName) {
        throw new Error('INSTANCE_CONNECTION_NAME environment variable is required');
      }

      // Configure connection pool
      const config = {
        user: process.env.DB_USER || 'postgres',
        password: dbPassword,
        database: process.env.DB_NAME || 'appraisily_activity_db',
        max: 10, // Reduce max connections
        idleTimeoutMillis: 10000, // Reduce idle timeout to 10 seconds
        connectionTimeoutMillis: 5000 // Increase connection timeout to 5 seconds
      };

      // Add Unix socket configuration if running in Cloud Run
      if (instanceConnectionName) {
        config.host = `${instanceUnixSocket}/${instanceConnectionName}`;
        // Disable SSL for Unix socket connections
        config.ssl = false;
        this.logger.info('Using Unix socket connection');
      } else {
        // Enable SSL only for TCP connections
        config.ssl = process.env.NODE_ENV === 'production';
        this.logger.info('Using TCP connection');
      }

      // Configure connection pool
      this.pool = new Pool(config);
      this.logger.info('Database pool configured');
      this.logger.info('Pool configuration:', {
        max: config.max,
        idleTimeoutMillis: config.idleTimeoutMillis,
        connectionTimeoutMillis: config.connectionTimeoutMillis
      });

      // Add error handler to the pool
      this.pool.on('error', (err, client) => {
        this.logger.error('Pool error:', {
          message: err.message,
          code: err.code,
          detail: err.detail,
          hint: err.hint,
          position: err.position
        });
      });

      // Add connection handler
      this.pool.on('connect', (client) => {
        this.logger.info('New client connected to the pool');
        client.on('error', err => {
          this.logger.error('Client error:', {
            message: err.message,
            code: err.code,
            detail: err.detail,
            hint: err.hint,
            position: err.position
          });
        });
      });

      // Test the connection
      this.logger.info('Testing database connection...');
      await this.pool.query('SELECT NOW()');
      this.logger.success('✓ Database connection test successful');

      this.logger.info('Checking database schema...');
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

      // Check for specific required tables
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
        this.logger.info('Missing required tables, applying schema...', {
          missing: missingTables
        });

        // Read and apply schema
        const schemaPath = require.resolve('../../migrations/init.sql');
        const fs = require('fs');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        try {
          await this.pool.query(schema);
          this.logger.success('✓ Schema applied successfully');

          // Verify tables were created
          const { rows: updatedRows } = await this.pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
          `);

          const stillMissing = requiredTables.filter(table => 
            !updatedRows.find(row => row.table_name === table)
          );

          if (stillMissing.length > 0) {
            throw new Error(`Failed to create tables: ${stillMissing.join(', ')}`);
          }

          this.logger.success('✓ All required tables created successfully');
        } catch (schemaError) {
          this.logger.error('Failed to apply schema:', {
            error: schemaError.message,
            code: schemaError.code,
            detail: schemaError.detail,
            hint: schemaError.hint,
            position: schemaError.position
          });
          throw schemaError;
        }
      } else {
        this.logger.success('✓ All required tables present');
      }

      // Check for specific required tables
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
        this.logger.error('Missing required tables:', {
          missing: missingTables,
          available: rows.map(row => row.table_name)
        });
      } else {
        this.logger.success('All required tables present');
      }

      this.logger.success('Database connection pool initialized');
    } catch (error) {
      this.logger.error('Failed to initialize database connection', error);
      throw error;
    }
  }

  async query(text, params) {
    if (!this.pool) {
      this.logger.error('Query attempted but pool not initialized');
      throw new Error('Database pool not initialized');
    }

    const start = Date.now();
    try {
      this.logger.info('Executing query:', {
        text,
        paramCount: params ? params.length : 0,
        params: params || []
      });
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      this.logger.info('Executed query', { 
        text, 
        duration,
        rowCount: result.rowCount 
      });
      return result;
    } catch (error) {
      this.logger.error('Query error:', {
        text,
        params,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetail: error.detail,
        errorHint: error.hint,
        errorPosition: error.position,
        duration: Date.now() - start
      });
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      try {
        this.logger.info('Disconnecting from database');
        // Wait for all queries to finish
        await Promise.all(this.pool.waitingCount);
        await this.pool.end();
        this.logger.success('Database disconnected successfully');
      } catch (error) {
        this.logger.error('Error disconnecting from database', error);
        throw error;
      }
    }
  }
}

module.exports = new DatabaseService();