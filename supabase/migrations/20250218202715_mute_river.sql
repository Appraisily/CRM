/*
  # Art Appraisal CRM Database Schema

  1. Overview
    - Complete database schema for the Art Appraisal CRM service
    - Includes all tables, enums, indexes, and triggers
    - Safe creation with IF NOT EXISTS checks
    - Proper error handling for existing objects

  2. Schema Components
    - Custom enum types for various statuses
    - Core tables for user data and activities
    - Chat and communication tables
    - Purchase and appraisal tracking
    - Bulk appraisal management
    - Automated timestamp management
    - Comprehensive indexing strategy

  3. Security Features
    - Email format validation
    - Numeric range constraints
    - Referential integrity
    - Automatic timestamp updates
*/

-- Create enum types with error handling
DO $$ BEGIN
  -- Activity Types
  CREATE TYPE activity_type AS ENUM (
    'chat', 'email', 'purchase', 'appraisal', 'website_visit'
  );
  CREATE TYPE activity_status AS ENUM (
    'started', 'completed', 'abandoned'
  );

  -- Communication Types
  CREATE TYPE chat_status AS ENUM (
    'active', 'closed'
  );
  CREATE TYPE email_type AS ENUM (
    'inquiry', 'support', 'report', 'offer'
  );
  CREATE TYPE email_status AS ENUM (
    'sent', 'delivered', 'opened', 'clicked', 'replied'
  );

  -- Transaction Types
  CREATE TYPE purchase_status AS ENUM (
    'pending', 'completed', 'refunded', 'failed'
  );
  CREATE TYPE service_type AS ENUM (
    'professional_appraisal', 'quick_assessment', 'consultation'
  );
  CREATE TYPE appraisal_status AS ENUM (
    'pending', 'completed', 'failed'
  );

  -- Bulk Appraisal Types
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

-- Create tables with proper constraints and defaults
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

-- Create indexes for performance optimization
DO $$ BEGIN
  -- User indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'users_email_idx') THEN
    CREATE INDEX users_email_idx ON users(email);
  END IF;

  -- Activity indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'user_activities_type_idx') THEN
    CREATE INDEX user_activities_type_idx ON user_activities(activity_type);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'user_activities_created_idx') THEN
    CREATE INDEX user_activities_created_idx ON user_activities(created_at);
  END IF;

  -- Status indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'chat_sessions_status_idx') THEN
    CREATE INDEX chat_sessions_status_idx ON chat_sessions(status);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'purchases_status_idx') THEN
    CREATE INDEX purchases_status_idx ON purchases(status);
  END IF;

  -- Session indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'appraisals_session_idx') THEN
    CREATE INDEX appraisals_session_idx ON appraisals(session_id);
  END IF;

  -- Type indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'email_interactions_type_idx') THEN
    CREATE INDEX email_interactions_type_idx ON email_interactions(type);
  END IF;

  -- Bulk appraisal indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'bulk_appraisals_session_idx') THEN
    CREATE INDEX bulk_appraisals_session_idx ON bulk_appraisals(session_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'bulk_appraisals_status_idx') THEN
    CREATE INDEX bulk_appraisals_status_idx ON bulk_appraisals(status);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'bulk_appraisal_items_status_idx') THEN
    CREATE INDEX bulk_appraisal_items_status_idx ON bulk_appraisal_items(status);
  END IF;
END $$;

-- Create functions for automated timestamp management
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_last_activity()
RETURNS trigger AS $$
BEGIN
  UPDATE users
  SET last_activity = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp management
DO $$ BEGIN
  -- Updated at triggers
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_activities_updated_at') THEN
    CREATE TRIGGER update_user_activities_updated_at
      BEFORE UPDATE ON user_activities
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_email_interactions_updated_at') THEN
    CREATE TRIGGER update_email_interactions_updated_at
      BEFORE UPDATE ON email_interactions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bulk_appraisals_updated_at') THEN
    CREATE TRIGGER update_bulk_appraisals_updated_at
      BEFORE UPDATE ON bulk_appraisals
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bulk_appraisal_items_updated_at') THEN
    CREATE TRIGGER update_bulk_appraisal_items_updated_at
      BEFORE UPDATE ON bulk_appraisal_items
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;

  -- Last activity triggers
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_activity') THEN
    CREATE TRIGGER update_user_activity
      AFTER INSERT ON user_activities
      FOR EACH ROW
      EXECUTE FUNCTION update_last_activity();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_chat_activity') THEN
    CREATE TRIGGER update_chat_activity
      AFTER INSERT ON chat_sessions
      FOR EACH ROW
      EXECUTE FUNCTION update_last_activity();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_purchase_activity') THEN
    CREATE TRIGGER update_purchase_activity
      AFTER INSERT ON purchases
      FOR EACH ROW
      EXECUTE FUNCTION update_last_activity();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_appraisal_activity') THEN
    CREATE TRIGGER update_appraisal_activity
      AFTER INSERT ON appraisals
      FOR EACH ROW
      EXECUTE FUNCTION update_last_activity();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_email_activity') THEN
    CREATE TRIGGER update_email_activity
      AFTER INSERT ON email_interactions
      FOR EACH ROW
      EXECUTE FUNCTION update_last_activity();
  END IF;
END $$;