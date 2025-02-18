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
        
        try {
          // Apply the schema directly
          await this.pool.query(`
            -- Create enum types
            DO $$ BEGIN
              CREATE TYPE activity_type AS ENUM (
                'chat', 'email', 'purchase', 'appraisal', 'website_visit'
              );
              CREATE TYPE activity_status AS ENUM (
                'started', 'completed', 'abandoned'
              );
              CREATE TYPE chat_status AS ENUM (
                'active', 'closed'
              );
              CREATE TYPE purchase_status AS ENUM (
                'pending', 'completed', 'refunded', 'failed'
              );
              CREATE TYPE service_type AS ENUM (
                'professional_appraisal', 'quick_assessment', 'consultation'
              );
              CREATE TYPE appraisal_status AS ENUM (
                'pending', 'completed', 'failed'
              );
              CREATE TYPE email_type AS ENUM (
                'inquiry', 'support', 'report', 'offer'
              );
              CREATE TYPE email_status AS ENUM (
                'sent', 'delivered', 'opened', 'clicked', 'replied'
              );
              CREATE TYPE bulk_appraisal_type AS ENUM (
                'regular', 'insurance', 'tax'
              );
              CREATE TYPE bulk_appraisal_status AS ENUM (
                'draft', 'pending_payment', 'paid', 'processing', 'completed', 'failed', 'cancelled'
              );
              CREATE TYPE bulk_item_status AS ENUM (
                'pending', 'processed'
              );
            EXCEPTION 
              WHEN duplicate_object THEN null;
            END $$;

            -- Create tables
            CREATE TABLE IF NOT EXISTS users (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              email text UNIQUE NOT NULL,
              created_at timestamptz DEFAULT now(),
              last_activity timestamptz DEFAULT now(),
              CONSTRAINT email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
            );

            CREATE TABLE IF NOT EXISTS user_activities (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id uuid REFERENCES users(id) ON DELETE CASCADE,
              activity_type activity_type NOT NULL,
              status activity_status NOT NULL DEFAULT 'started',
              metadata jsonb DEFAULT '{}',
              created_at timestamptz DEFAULT now(),
              updated_at timestamptz DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS chat_sessions (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id uuid REFERENCES users(id) ON DELETE CASCADE,
              agent_id text,
              status chat_status NOT NULL DEFAULT 'active',
              started_at timestamptz DEFAULT now(),
              ended_at timestamptz,
              transcript text,
              satisfaction_score integer,
              CONSTRAINT satisfaction_score_range CHECK (
                satisfaction_score IS NULL OR 
                (satisfaction_score >= 1 AND satisfaction_score <= 5)
              )
            );

            CREATE TABLE IF NOT EXISTS purchases (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id uuid REFERENCES users(id) ON DELETE CASCADE,
              service_type service_type NOT NULL,
              amount decimal NOT NULL CHECK (amount > 0),
              currency text NOT NULL DEFAULT 'USD',
              status purchase_status NOT NULL DEFAULT 'pending',
              payment_method text,
              created_at timestamptz DEFAULT now(),
              completed_at timestamptz
            );

            CREATE TABLE IF NOT EXISTS appraisals (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id uuid REFERENCES users(id) ON DELETE CASCADE,
              session_id uuid NOT NULL,
              image_url text NOT NULL,
              status appraisal_status NOT NULL DEFAULT 'pending',
              result_summary jsonb DEFAULT '{}',
              created_at timestamptz DEFAULT now(),
              completed_at timestamptz
            );

            CREATE TABLE IF NOT EXISTS email_interactions (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id uuid REFERENCES users(id) ON DELETE CASCADE,
              type email_type NOT NULL,
              subject text NOT NULL,
              content text NOT NULL,
              status email_status NOT NULL DEFAULT 'sent',
              created_at timestamptz DEFAULT now(),
              updated_at timestamptz DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS bulk_appraisals (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id uuid REFERENCES users(id) ON DELETE CASCADE,
              session_id text NOT NULL,
              appraisal_type bulk_appraisal_type NOT NULL,
              status bulk_appraisal_status NOT NULL DEFAULT 'draft',
              total_price decimal NOT NULL,
              discount_type text,
              discount_percentage decimal,
              discount_amount decimal,
              final_price decimal NOT NULL,
              created_at timestamptz DEFAULT now(),
              updated_at timestamptz DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS bulk_appraisal_items (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              bulk_appraisal_id uuid REFERENCES bulk_appraisals(id) ON DELETE CASCADE,
              item_id text NOT NULL,
              file_url text NOT NULL,
              description text,
              category text,
              price decimal NOT NULL,
              status bulk_item_status NOT NULL DEFAULT 'pending',
              created_at timestamptz DEFAULT now(),
              updated_at timestamptz DEFAULT now()
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
            CREATE INDEX IF NOT EXISTS user_activities_type_idx ON user_activities(activity_type);
            CREATE INDEX IF NOT EXISTS user_activities_created_idx ON user_activities(created_at);
            CREATE INDEX IF NOT EXISTS chat_sessions_status_idx ON chat_sessions(status);
            CREATE INDEX IF NOT EXISTS purchases_status_idx ON purchases(status);
            CREATE INDEX IF NOT EXISTS appraisals_session_idx ON appraisals(session_id);
            CREATE INDEX IF NOT EXISTS email_interactions_type_idx ON email_interactions(type);
            CREATE INDEX IF NOT EXISTS bulk_appraisals_session_idx ON bulk_appraisals(session_id);
            CREATE INDEX IF NOT EXISTS bulk_appraisals_status_idx ON bulk_appraisals(status);
            CREATE INDEX IF NOT EXISTS bulk_appraisal_items_status_idx ON bulk_appraisal_items(status);
          `);
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
            detail: schemaError.detail
          });
          throw schemaError;
        }
      } else {
        this.logger.success('✓ All required tables present');
      }
      });

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