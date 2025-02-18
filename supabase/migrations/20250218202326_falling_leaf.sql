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