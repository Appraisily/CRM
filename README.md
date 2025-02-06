# Art Appraisal CRM Service

A dedicated Node.js service for handling customer relationship management (CRM) and communications for the Art Appraisal platform. This service processes PubSub messages using a pull subscription model to manage customer communications, email campaigns, and customer interactions.

## Architecture Overview

This service is part of a microservices architecture where:
- Analysis and processing are handled by separate services
- The CRM service focuses on customer communications
- Communication workflows are triggered by Google Cloud PubSub messages using a pull subscription
- All customer data and interaction history are tracked in Google Sheets
- Secure message handling with automatic retries and error recovery

### Pull Subscription Model

The service implements a robust pull subscription pattern:
- Continuously pulls messages from PubSub subscription
- Processes one message at a time to ensure reliability
- Automatic message acknowledgment after successful processing
- Built-in retry mechanism for failed messages
- Graceful shutdown handling for SIGTERM and SIGINT signals

## Core Features

### Message Processing
- Pull-based PubSub message handling
- Screener notification processing
- Analysis completion notifications
- Email campaign triggers
- Robust error handling and validation

### Email Communications
- Professional HTML email templates
- Automated email campaign management
- Personalized offer generation using Michelle API
- Analysis report delivery
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
- Communication history logging
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
- `PORT`: Server port (default: 8080)
- `PUBSUB_SUBSCRIPTION_NAME`: Name of the PubSub subscription to pull messages from

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
- All errors are logged with full stack traces
- Graceful shutdown ensures no messages are lost

## Monitoring

Monitor the service using:
- Google Cloud Logging for application logs
- Google Sheets for process tracking
- SendGrid dashboard for email delivery status
- Cloud Run metrics for service health