/*
  # Add bulk appraisals schema

  1. New Tables
    - `bulk_appraisals`
      - Tracks overall bulk appraisal requests
      - Includes payment and status tracking
      - Stores pricing and discount information
    - `bulk_appraisal_items`
      - Tracks individual items within a bulk request
      - Links to parent bulk_appraisal
      - Stores item-specific details and status

  2. New Types
    - `bulk_appraisal_type`: Type of appraisal (regular, insurance, tax)
    - `bulk_appraisal_status`: Enhanced status tracking including payment states
    - `bulk_item_status`: Status tracking for individual items

  3. Security
    - Enable RLS on both tables
    - Add policies for user access and service role management
*/

-- Create enum types
CREATE TYPE bulk_appraisal_type AS ENUM (
  'regular',
  'insurance',
  'tax'
);

CREATE TYPE bulk_appraisal_status AS ENUM (
  'draft',
  'pending_payment',
  'paid',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE bulk_item_status AS ENUM (
  'pending',
  'processed'
);

-- Create bulk appraisals table
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
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT bulk_appraisals_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

-- Create bulk appraisal items table
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
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT bulk_appraisal_items_appraisal_fk FOREIGN KEY (bulk_appraisal_id)
    REFERENCES bulk_appraisals(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS bulk_appraisals_session_idx ON bulk_appraisals(session_id);
CREATE INDEX IF NOT EXISTS bulk_appraisals_status_idx ON bulk_appraisals(status);
CREATE INDEX IF NOT EXISTS bulk_appraisal_items_status_idx ON bulk_appraisal_items(status);

-- Enable Row Level Security
ALTER TABLE bulk_appraisals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_appraisal_items ENABLE ROW LEVEL SECURITY;

-- Create policies for bulk_appraisals
CREATE POLICY "Users can read own bulk appraisals"
  ON bulk_appraisals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage bulk appraisals"
  ON bulk_appraisals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policies for bulk_appraisal_items
CREATE POLICY "Users can read own bulk appraisal items"
  ON bulk_appraisal_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bulk_appraisals
      WHERE id = bulk_appraisal_items.bulk_appraisal_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Service can manage bulk appraisal items"
  ON bulk_appraisal_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_bulk_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_bulk_appraisals_updated_at
  BEFORE UPDATE ON bulk_appraisals
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_updated_at();

CREATE TRIGGER update_bulk_appraisal_items_updated_at
  BEFORE UPDATE ON bulk_appraisal_items
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_updated_at();