# Art Appraisal CRM Service

A dedicated Node.js service for handling customer relationship management (CRM) and communications for the Art Appraisal platform. This service processes PubSub messages using a pull subscription model to manage customer communications, email campaigns, and customer interactions.

## Architecture Overview

This service is part of a microservices architecture where:
- Analysis and processing are handled by separate services
- The CRM service focuses on customer communications
- Communication workflows are triggered by Google Cloud PubSub messages using a pull subscription
- All customer data and interaction history are tracked in Google Sheets
- Secure message handling with automatic retries and error recovery
- RESTful API for customer data access with authentication and rate limiting

## Customer Data API

The service provides a secure REST API for accessing customer data:

### Authentication
- Requires API key in `x-api-key` header
- Keys are managed in Secret Manager
- Rate limited to 100 requests per 15 minutes per IP

### Endpoints

1. **Get Customer Profile**
   ```http
   GET /api/customers/:email
   ```
   Returns aggregated customer data including:
   - Basic information
   - Total purchases and amount spent
   - Number of appraisals
   - Chat and email interaction counts

2. **Get Customer Activities**
   ```http
   GET /api/customers/:email/activities
   ```
   Returns paginated activity history with:
   - Activity type and status
   - Timestamps
   - Associated metadata
   Query parameters:
   - `limit`: Number of records (default: 10)
   - `offset`: Pagination offset

3. **Get Customer Purchases**
   ```http
   GET /api/customers/:email/purchases
   ```
   Returns purchase history including:
   - Service type
   - Amount and currency
   - Payment status
   - Timestamps

4. **Get Customer Appraisals**
   ```http
   GET /api/customers/:email/appraisals
   ```
   Returns appraisal history with:
   - Session IDs
   - Status
   - Results summary
   - Timestamps

### Message Types

The service processes the following PubSub message types (✓ = fully implemented, ⚠️ = partial implementation, ❌ = not implemented):

1. **Bulk Appraisal Email Update** (`bulkAppraisalEmailUpdate`) ✓
   - Triggered when a user starts a bulk appraisal submission
   - Creates initial database records and sends recovery email
   - Fields:
     ```json
     {
       "crmProcess": "bulkAppraisalEmailUpdate",
       "customer": {
         "email": "string"
       },
       "metadata": {
         "sessionId": "string",
         "origin": "string",
         "environment": "string",
         "timestamp": "number"
       }
     }
     ```

2. **Screener Notification** (`screenerNotification`) ✓
   - Triggered when a user submits an image for initial screening
   - Sends free analysis report and schedules personal offer
   - Fields:
     ```json
     {
       "crmProcess": "screenerNotification",
       "customer": {
         "email": "string",
         "name": "string"
       },
       "sessionId": "uuid",
       "metadata": {
         "imageUrl": "string",
         "timestamp": "number"
       }
     }
     ```

3. **Chat Summary** (`chatSummary`) ✓
   - Records completed chat session details
   - Stores transcript and satisfaction score
   - Fields:
     ```json
     {
       "crmProcess": "chatSummary",
       "customer": {
         "email": "string"
       },
       "chat": {
         "sessionId": "string",
         "startedAt": "string",
         "endedAt": "string",
         "messageCount": "number",
         "satisfactionScore": "number",
         "summary": "string",
         "topics": "string[]",
         "sentiment": "string"
       },
       "metadata": {
         "agentId": "string",
         "origin": "string"
       }
     }
     ```

4. **Gmail Interaction** (`gmailInteraction`) ✓
   - Processes email interactions from Gmail
   - Records email content and classification
   - Fields:
     ```json
     {
       "crmProcess": "gmailInteraction",
       "customer": {
         "email": "string",
         "name": "string"
       },
       "email": {
         "messageId": "string",
         "threadId": "string",
         "subject": "string",
         "content": "string",
         "timestamp": "string",
         "classification": {
           "intent": "string",
           "urgency": "string",
           "responseType": "string",
           "requiresReply": "boolean"
         }
       },
       "metadata": {
         "labels": "string[]",
         "processingTime": "number"
       }
     }
     ```

5. **Appraisal Request** (`appraisalRequest`) ✓
   - Handles professional appraisal requests
   - Records appraisal details and generates documents
   - Fields:
     ```json
     {
       "crmProcess": "appraisalRequest",
       "customer": {
         "email": "string",
         "name": "string"
       },
       "appraisal": {
         "serviceType": "string",
         "sessionId": "string",
         "requestDate": "string",
         "status": "string",
         "editLink": "string",
         "images": {
           "description": "string",
           "customerDescription": "string",
           "appraisersDescription": "string",
           "finalDescription": "string"
         },
         "value": {
           "amount": "number",
           "currency": "string",
           "range": {
             "min": "number",
             "max": "number"
           }
         }
       },
       "metadata": {
         "origin": "string",
         "timestamp": "number"
       }
     }
     ```

6. **Stripe Payment** (`stripePayment`) ✓
   - Records completed purchases and payment information
   - Updates user purchase history and activity
   - Fields:
     ```json
     {
       "crmProcess": "stripePayment",
       "customer": {
         "email": "string",
         "name": "string",
         "stripeCustomerId": "string"
       },
       "payment": {
         "checkoutSessionId": "string",
         "paymentIntentId": "string",
         "amount": "number",
         "currency": "string",
         "status": "string",
         "metadata": {
           "serviceType": "string",
           "sessionId": "string"
         }
       },
       "metadata": {
         "origin": "string",
         "environment": "string",
         "timestamp": "number"
       }
     }
     ```

7. **Bulk Appraisal Finalized** (`bulkAppraisalFinalized`) ⚠️
   - Handles completed bulk appraisal submissions
   - Updates status and pricing information
   - Current Implementation: Basic message acknowledgment only
   - Fields:
     ```json
     {
       "crmProcess": "bulkAppraisalFinalized",
       "customer": {
         "email": "string",
         "notes": "string"
       },
       "appraisal": {
         "type": "string",
         "itemCount": "number",
         "sessionId": "string"
       },
       "metadata": {
         "origin": "string",
         "environment": "string",
         "timestamp": "number"
       }
     }
     ```

8. **Reset Password Request** (`resetPasswordRequest`) ✓
   - Handles password reset requests
   - Sends password reset email with secure token
   - Fields:
     ```json
     {
       "crmProcess": "resetPasswordRequest",
       "customer": {
         "email": "string"
       },
       "token": "string",
       "metadata": {
         "timestamp": "number"
       }
     }
     ```

9. **New Registration Email** (`newRegistrationEmail`) ✓
   - Sends welcome email to newly registered users
   - Includes account features and getting started information
   - Fields:
     ```json
     {
       "crmProcess": "newRegistrationEmail",
       "customer": {
         "email": "string"
       },
       "metadata": {
         "timestamp": "number"
       }
     }
     ```

### Message Processing Implementation Details

1. **Bulk Appraisal Email Update**
   - Full database integration
   - Email recovery system
   - Sheet logging
   - Activity tracking

2. **Screener Notification**
   - Analysis processing
   - Report generation
   - Email delivery
   - Sheet logging

3. **Chat Summary**
   - Session recording
   - Transcript storage
   - Satisfaction tracking
   - Activity logging

4. **Gmail Interaction**
   - Email classification
   - Content analysis
   - Response tracking
   - Activity logging

5. **Appraisal Request**
   - Full appraisal workflow
   - Document generation
   - Status tracking
   - Result storage

6. **Stripe Payment**
   - Payment processing
   - Purchase recording
   - Activity tracking
   - Status updates

7. **Bulk Appraisal Finalized**
   - Basic message validation
   - Message acknowledgment
   - Pending: Database integration
   - Pending: Status updates
   - Pending: Activity tracking

### Pull Subscription Model

The service implements a robust pull subscription pattern:
- Continuously pulls messages from PubSub subscription
- Processes one message at a time to ensure reliability
- Automatic message acknowledgment after successful processing
- Built-in retry mechanism for failed messages
- Graceful shutdown handling for SIGTERM and SIGINT signals

## Core Features

### Message Processing
- Bulk appraisal submission handling
- Recovery email generation for incomplete submissions
- Pull-based PubSub message handling
- Screener notification processing
- Analysis completion notifications
- Email campaign triggers
- Robust error handling and validation

### Email Communications
- Professional HTML email templates
- Automated email campaign management
- Bulk appraisal recovery notifications
- Personalized offer generation using Michelle API
- Analysis report delivery
- Smart retry logic for failed communications
- Rate-limited submissions

### Message Processing
- Validation for each message type
- Processor factory pattern for message handling
- Dead Letter Queue (DLQ) for failed messages
- Automatic retries with exponential backoff
- Comprehensive error logging and monitoring
- Smart retry logic for failed communications
- Rate-limited submissions

### Security & Privacy
- Email encryption using AES-256-GCM
- Argon2 password hashing for secure storage
- Rate limiting protection (5 requests per minute)
- CORS protection with domain allowlist

### Data Management
- Customer interaction tracking in Google Sheets
- Email delivery status monitoring
- Bulk appraisal progress tracking
- Communication history logging
- Activity tracking in PostgreSQL database
- API access monitoring and rate limiting
- Real-time status updates
- Automated sheet updates for all processes

## Message Processing Flow

When a screener notification message is received via PubSub pull subscription:

### 1. Message Format
```json
{
  "crmProcess": "screenerNotification",
  "customer": {
    "email": "customer@example.com",
    "name": "Customer Name"
  },
  "origin": "screener",
  "timestamp": 1703187654321,
  "sessionId": "uuid-v4-session-id",
  "metadata": {
    "originalName": "artwork.jpg",
    "imageUrl": "https://storage.googleapis.com/bucket-name/sessions/uuid/UserUploadedImage.jpg",
    "timestamp": 1703187654321,
    "analyzed": false,
    "originAnalyzed": false,
    "size": 1024000,
    "mimeType": "image/jpeg"
  }
}
```

### 2. Process Flow
1. **Message Reception**
   - PubSub service pulls messages from subscription
   - Decodes message data
   - Validates message structure and required fields
   - Routes to appropriate handler based on crmProcess

2. **Initial Processing**
   - Extracts customer email, session ID, and metadata
   - Begins logging process
   - Initiates parallel workflows for report and offer

3. **Sheet Logging**
   - Finds or creates row for session ID
   - Records:
     - Timestamp
     - Session ID
     - Customer email
     - Communication type ("Screener")

4. **Free Report Generation**
   - Composes initial analysis report using:
     - Image metadata
     - Basic file information
     - Placeholder for analysis results
   - Generates HTML email using report template
   - Sends via SendGrid
   - Updates sheet with report status

5. **Personal Offer Scheduling**
   - Calculates scheduled time (1 hour after notification)
   - Generates personalized content via Michelle API using:
     - Customer information
     - Image metadata
     - Session details
   - Schedules email delivery via SendGrid
   - Updates sheet with offer status and scheduled time

### 3. Sheet Structure
The service maintains a detailed log in Google Sheets with the following columns:
```
A: Timestamp
B: Session ID
C: Upload Time
D: Image URL
E: Analysis Status
F: Analysis Time
G: Origin Status
H: Origin Time
I: Email
J: Email Submission Time
K: Free Report Status
L: Free Report Time
M: Offer Status
N: Offer Time
O: Offer Delivered
P: Offer Content
```

## Required Configuration

### Environment Variables
- `SENDGRID_BULK_APPRAISAL_RESUBMISSION`: SendGrid template ID for bulk appraisal recovery emails
- `PORT`: Server port (default: 8080)
- `PUBSUB_SUBSCRIPTION_NAME`: Name of the PubSub subscription to pull messages from
- `DB_USER`: Database user (default: postgres)
- `DB_NAME`: Database name (default: appraisily_activity_db)
- `DB_SOCKET_PATH`: Unix socket path for Cloud SQL
- `INSTANCE_CONNECTION_NAME`: Cloud SQL instance connection name

### Google Cloud Secret Manager Secrets
- `EMAIL_ENCRYPTION_KEY`
- `SENDGRID_API_KEY`
- `SENDGRID_EMAIL`
- `SEND_GRID_TEMPLATE_FREE_REPORT`
- `SEND_GRID_TEMPLATE_PERSONAL_OFFER`
- `DIRECT_API_KEY` (for Michelle API)
- `SHEETS_ID_FREE_REPORTS_LOG`
- `GOOGLE_CLOUD_PROJECT_ID`
- `GCS_BUCKET_NAME`
- `OPENAI_API_KEY`
- `service-account-json`
- `DB_PASSWORD`: Database password
- `API_KEYS`: JSON array of valid API keys and permissions

## Development

1. Set up Google Cloud project and enable required APIs:
   - Cloud PubSub
   - Secret Manager
   - Sheets API
   - Cloud Storage

2. Install dependencies:
```bash
npm install
```

3. Start the service:
```bash
npm start
```

The service will start on port 8080 and begin pulling messages from the configured PubSub subscription.

## Deployment

Build and run using Docker:

```bash
docker build -t art-appraisal-crm .
docker run -p 8080:8080 \
  -e PUBSUB_SUBSCRIPTION_NAME=your-subscription-name \
  art-appraisal-crm
```

## Error Handling

The service implements comprehensive error handling:
- Message validation errors are logged and messages are nacked
- Processing errors trigger automatic retries
- Failed messages can be sent to a Dead Letter Queue (DLQ) if configured
- API rate limiting and authentication errors
- All errors are logged with full stack traces and context
- Graceful shutdown ensures no messages are lost
- Dead Letter Queue monitoring for failed messages
- Database connection pool metrics

## Monitoring

Monitor the service using:
- Google Cloud Logging for application logs
- Google Sheets for process tracking
- SendGrid dashboard for email delivery status
- API access and rate limit metrics
- Cloud Run metrics for service health

## Testing Message Handlers

The service provides a secure endpoint for testing message handlers in any environment, including production. This allows verification of email delivery and message processing functionality.

### Test Endpoint

```http
POST /api/test-handlers
```

**Authentication:**
- Requires test API key in `x-api-key` header
- Key must match `TEST_HANDLERS_API_KEY` environment variable

### Usage

1. **Test All Handlers:**
```bash
curl -X POST \
  -H "x-api-key: your-test-api-key" \
  "https://your-service-url/api/test-handlers"
```

2. **Test Specific Handler:**
```bash
curl -X POST \
  -H "x-api-key: your-test-api-key" \
  "https://your-service-url/api/test-handlers?process=resetPasswordRequest"
```

### Test Configuration

- All test emails are sent to: `ratonxi@gmail.com`
- Messages are marked with test metadata
- Results include success/failure status for each handler
- Comprehensive logging of test executions

### Response Format

For a single handler:
```json
{
  "success": true,
  "process": "resetPasswordRequest",
  "result": {
    "success": true,
    "email": "ratonxi@gmail.com"
  }
}
```

For all handlers:
```json
{
  "success": true,
  "results": [
    {
      "process": "resetPasswordRequest",
      "success": true,
      "result": {
        "success": true,
        "email": "ratonxi@gmail.com"
      }
    },
    // ... other results ...
  ]
}
```

### Available Test Processes

- `bulkAppraisalEmailUpdate`
- `resetPasswordRequest`
- `newRegistrationEmail`
- `screenerNotification`
- `chatSummary`
- `gmailInteraction`
- `appraisalRequest`
- `stripePayment`
- `bulkAppraisalFinalized`

### Security Considerations

- Test endpoint is protected by a dedicated API key
- All test messages are clearly marked in logs and analytics
- Test emails are isolated to a single controlled address
- No impact on production data or real user communications