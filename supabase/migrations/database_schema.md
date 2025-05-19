# Database Schema

## Enum Types

### Activity Related
- **activity_type**: 'chat', 'email', 'purchase', 'appraisal', 'website_visit'
- **activity_status**: 'started', 'completed', 'abandoned'

### Communication Related
- **chat_status**: 'active', 'closed'
- **email_type**: 'inquiry', 'support', 'report', 'offer'
- **email_status**: 'sent', 'delivered', 'opened', 'clicked', 'replied'

### Transaction Related
- **purchase_status**: 'pending', 'completed', 'refunded', 'failed'
- **service_type**: 'professional_appraisal', 'quick_assessment', 'consultation'
- **appraisal_status**: 'pending', 'completed', 'failed'

### Bulk Appraisal Related
- **bulk_appraisal_type**: 'regular', 'insurance', 'tax'
- **bulk_appraisal_status**: 'draft', 'pending_payment', 'paid', 'processing', 'completed', 'failed', 'cancelled'
- **bulk_item_status**: 'pending', 'processed'

## Tables

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() |
| email | text | UNIQUE NOT NULL, CHECK (valid email format) |
| created_at | timestamptz | DEFAULT now() |
| last_activity | timestamptz | DEFAULT now() |

### user_activities
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() |
| user_id | uuid | REFERENCES users(id) ON DELETE CASCADE |
| activity_type | activity_type | NOT NULL |
| status | activity_status | NOT NULL DEFAULT 'started' |
| metadata | jsonb | DEFAULT '{}' |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

### chat_sessions
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() |
| user_id | uuid | REFERENCES users(id) ON DELETE CASCADE |
| agent_id | text | |
| status | chat_status | NOT NULL DEFAULT 'active' |
| started_at | timestamptz | DEFAULT now() |
| ended_at | timestamptz | |
| transcript | text | |
| satisfaction_score | integer | CHECK (score between 1-5 or NULL) |

### purchases
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() |
| user_id | uuid | REFERENCES users(id) ON DELETE CASCADE |
| service_type | service_type | NOT NULL |
| amount | decimal | NOT NULL CHECK (amount > 0) |
| currency | text | NOT NULL DEFAULT 'USD' |
| status | purchase_status | NOT NULL DEFAULT 'pending' |
| payment_method | text | |
| created_at | timestamptz | DEFAULT now() |
| completed_at | timestamptz | |

### appraisals
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() |
| user_id | uuid | REFERENCES users(id) ON DELETE CASCADE |
| session_id | text | NOT NULL |
| image_url | text | NOT NULL |
| status | appraisal_status | NOT NULL DEFAULT 'pending' |
| result_summary | jsonb | DEFAULT '{}' |
| created_at | timestamptz | DEFAULT now() |
| completed_at | timestamptz | |

### email_interactions
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() |
| user_id | uuid | REFERENCES users(id) ON DELETE CASCADE |
| type | email_type | NOT NULL |
| subject | text | NOT NULL |
| content | text | NOT NULL |
| status | email_status | NOT NULL DEFAULT 'sent' |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

### bulk_appraisals
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() |
| user_id | uuid | REFERENCES users(id) ON DELETE CASCADE |
| session_id | text | NOT NULL |
| appraisal_type | bulk_appraisal_type | NOT NULL |
| status | bulk_appraisal_status | NOT NULL DEFAULT 'draft' |
| total_price | decimal | NOT NULL |
| discount_type | text | |
| discount_percentage | decimal | |
| discount_amount | decimal | |
| final_price | decimal | NOT NULL |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

### bulk_appraisal_items
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() |
| bulk_appraisal_id | uuid | REFERENCES bulk_appraisals(id) ON DELETE CASCADE |
| item_id | text | NOT NULL |
| file_url | text | NOT NULL |
| description | text | |
| category | text | |
| price | decimal | NOT NULL |
| status | bulk_item_status | NOT NULL DEFAULT 'pending' |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

## Indexes

### User Indexes
- **users_email_idx**: ON users(email)

### Activity Indexes
- **user_activities_type_idx**: ON user_activities(activity_type)
- **user_activities_created_idx**: ON user_activities(created_at)

### Status Indexes
- **chat_sessions_status_idx**: ON chat_sessions(status)
- **purchases_status_idx**: ON purchases(status)
- **bulk_appraisals_status_idx**: ON bulk_appraisals(status)
- **bulk_appraisal_items_status_idx**: ON bulk_appraisal_items(status)

### Session Indexes
- **appraisals_session_idx**: ON appraisals(session_id)
- **bulk_appraisals_session_idx**: ON bulk_appraisals(session_id)

### Type Indexes
- **email_interactions_type_idx**: ON email_interactions(type)

## Functions

### update_updated_at
- **Purpose**: Automatically updates the 'updated_at' timestamp
- **Trigger**: Used in various table update triggers

### update_last_activity
- **Purpose**: Updates a user's last_activity timestamp when related records are inserted
- **Trigger**: Used in various table insert triggers

## Triggers

### Updated At Triggers
- **update_user_activities_updated_at**: BEFORE UPDATE ON user_activities
- **update_email_interactions_updated_at**: BEFORE UPDATE ON email_interactions
- **update_bulk_appraisals_updated_at**: BEFORE UPDATE ON bulk_appraisals
- **update_bulk_appraisal_items_updated_at**: BEFORE UPDATE ON bulk_appraisal_items

### Last Activity Triggers
- **update_user_activity**: AFTER INSERT ON user_activities
- **update_chat_activity**: AFTER INSERT ON chat_sessions
- **update_purchase_activity**: AFTER INSERT ON purchases
- **update_appraisal_activity**: AFTER INSERT ON appraisals
- **update_email_activity**: AFTER INSERT ON email_interactions

## Entity Relationships

- **users** → One-to-Many → **user_activities**, **chat_sessions**, **purchases**, **appraisals**, **email_interactions**, **bulk_appraisals**
- **bulk_appraisals** → One-to-Many → **bulk_appraisal_items** 