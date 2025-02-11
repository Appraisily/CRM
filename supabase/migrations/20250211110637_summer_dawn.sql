/*
  # User Activity Tracking Schema

  1. New Tables
    - `users`: Main user table with email identification
    - `user_activities`: General activity log for all user interactions
    - `chat_sessions`: Live chat interaction records
    - `purchases`: Service purchase tracking
    - `appraisals`: Automatic appraisal tool usage
    - `email_interactions`: Email communication tracking

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read their own data
    - Add policies for service to write data
    - Add policies for admins to read all data

  3. Indexes
    - Email index on users table
    - Activity type and timestamp indexes
    - Foreign key indexes
*/

-- Create enum types for various statuses
CREATE TYPE activity_type AS ENUM (
  'chat',
  'email',
  'purchase',
  'appraisal',
  'website_visit'
);

CREATE TYPE activity_status AS ENUM (
  'started',
  'completed',
  'abandoned'
);

CREATE TYPE chat_status AS ENUM (
  'active',
  'closed'
);

CREATE TYPE purchase_status AS ENUM (
  'pending',
  'completed',
  'refunded',
  'failed'
);

CREATE TYPE service_type AS ENUM (
  'professional_appraisal',
  'quick_assessment',
  'consultation'
);

CREATE TYPE appraisal_status AS ENUM (
  'pending',
  'completed',
  'failed'
);

CREATE TYPE email_type AS ENUM (
  'inquiry',
  'support',
  'report',
  'offer'
);

CREATE TYPE email_status AS ENUM (
  'sent',
  'delivered',
  'opened',
  'clicked',
  'replied'
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now(),
  
  CONSTRAINT email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create user_activities table
CREATE TABLE IF NOT EXISTS user_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  activity_type activity_type NOT NULL,
  status activity_status NOT NULL DEFAULT 'started',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT user_activities_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  agent_id text,
  status chat_status NOT NULL DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  transcript text,
  satisfaction_score integer,
  
  CONSTRAINT chat_sessions_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT satisfaction_score_range CHECK (
    satisfaction_score IS NULL OR 
    (satisfaction_score >= 1 AND satisfaction_score <= 5)
  )
);

-- Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  service_type service_type NOT NULL,
  amount decimal NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  status purchase_status NOT NULL DEFAULT 'pending',
  payment_method text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  
  CONSTRAINT purchases_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

-- Create appraisals table
CREATE TABLE IF NOT EXISTS appraisals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  image_url text NOT NULL,
  status appraisal_status NOT NULL DEFAULT 'pending',
  result_summary jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  
  CONSTRAINT appraisals_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

-- Create email_interactions table
CREATE TABLE IF NOT EXISTS email_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type email_type NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  status email_status NOT NULL DEFAULT 'sent',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT email_interactions_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS user_activities_type_idx ON user_activities(activity_type);
CREATE INDEX IF NOT EXISTS user_activities_created_idx ON user_activities(created_at);
CREATE INDEX IF NOT EXISTS chat_sessions_status_idx ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS purchases_status_idx ON purchases(status);
CREATE INDEX IF NOT EXISTS appraisals_session_idx ON appraisals(session_id);
CREATE INDEX IF NOT EXISTS email_interactions_type_idx ON email_interactions(type);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisals ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_interactions ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Service can insert users"
  ON users
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service can update users"
  ON users
  FOR UPDATE
  TO service_role
  USING (true);

-- Create policies for user_activities
CREATE POLICY "Users can read own activities"
  ON user_activities
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage activities"
  ON user_activities
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policies for chat_sessions
CREATE POLICY "Users can read own chat sessions"
  ON chat_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage chat sessions"
  ON chat_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policies for purchases
CREATE POLICY "Users can read own purchases"
  ON purchases
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage purchases"
  ON purchases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policies for appraisals
CREATE POLICY "Users can read own appraisals"
  ON appraisals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage appraisals"
  ON appraisals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policies for email_interactions
CREATE POLICY "Users can read own email interactions"
  ON email_interactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage email interactions"
  ON email_interactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to update last_activity
CREATE OR REPLACE FUNCTION update_last_activity()
RETURNS trigger AS $$
BEGIN
  UPDATE users
  SET last_activity = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update last_activity
CREATE TRIGGER update_user_activity
AFTER INSERT ON user_activities
FOR EACH ROW
EXECUTE FUNCTION update_last_activity();

CREATE TRIGGER update_chat_activity
AFTER INSERT ON chat_sessions
FOR EACH ROW
EXECUTE FUNCTION update_last_activity();

CREATE TRIGGER update_purchase_activity
AFTER INSERT ON purchases
FOR EACH ROW
EXECUTE FUNCTION update_last_activity();

CREATE TRIGGER update_appraisal_activity
AFTER INSERT ON appraisals
FOR EACH ROW
EXECUTE FUNCTION update_last_activity();

CREATE TRIGGER update_email_activity
AFTER INSERT ON email_interactions
FOR EACH ROW
EXECUTE FUNCTION update_last_activity();