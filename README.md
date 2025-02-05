# Art Appraisal CRM Service

A dedicated Node.js service for handling customer relationship management (CRM) and communications for the Art Appraisal platform. This service processes PubSub messages to trigger customer communications, manage email campaigns, and handle customer interactions.

## Overview

This service is part of a microservices architecture where:
- Analysis and processing are handled by separate services
- This CRM service focuses solely on customer communications
- Communication workflows are triggered by Google Cloud PubSub messages
- All customer data and interaction history are tracked and logged

## Core Features

### Message Processing
- Handles PubSub messages for customer communications
- Processes screener notifications
- Manages analysis completion notifications
- Coordinates email campaign triggers

### Email Communications
- Professional HTML email templates
- Automated email campaign management
- Personalized offer generation
- Analysis report delivery
- Smart retry logic for failed communications
- Rate-limited submissions

### Security & Privacy
- Email encryption using AES-256-GCM
- Argon2 password hashing for secure storage
- Rate limiting protection (5 requests per minute)
- CORS protection with domain allowlist

### PubSub Integration
- Push-based message handling via `/push-handler` endpoint
- Secure message validation and processing
- Automated customer communication workflows
- Error handling and retry mechanisms

### Data Management
- Customer interaction tracking in Google Sheets
- Email delivery status monitoring
- Communication history logging
- Automated sheet updates for all processes

## Screener Notification Process

When a screener notification message is received via PubSub, the service follows this workflow:

### 1. Message Reception and Validation
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
1. **Message Reception** (`/push-handler` endpoint)
   - Receives PubSub push message
   - Decodes base64-encoded message data
   - Validates message structure and required fields
   - Routes to `handleScreenerNotification` for processing

2. **Initial Processing** (`handleScreenerNotification`)
   - Extracts customer email, session ID, and metadata
   - Begins logging process
   - Initiates parallel workflows for report and offer

3. **Sheet Logging** (`sheetsService.updateEmailSubmission`)
   - Finds or creates row for session ID
   - Records:
     - Timestamp
     - Session ID
     - Customer email
     - Communication type ("Screener")

4. **Free Report Generation** (`emailService.sendFreeReport`)
   - Composes initial analysis report using:
     - Image metadata
     - Basic file information
     - Placeholder for analysis results
   - Generates HTML email using report template
   - Sends via SendGrid
   - Updates sheet with report status

5. **Personal Offer Scheduling** (`emailService.sendPersonalOffer`)
   - Calculates scheduled time (1 hour after notification)
   - Generates personalized content via Michelle API using:
     - Customer information
     - Image metadata
     - Session details
   - Schedules email delivery via SendGrid
   - Updates sheet with offer status and scheduled time

6. **Status Updates** (`sheetsService`)
   - Updates free report delivery status
   - Records offer scheduling status
   - Logs all timestamps and content hashes

7. **Error Handling**
   - Catches and logs all errors
   - Maintains transaction log in sheets
   - Allows for manual intervention if needed

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

### 4. Success Criteria
A screener notification is considered successfully processed when:
1. Customer email is logged in sheets
2. Free report is sent and delivery confirmed
3. Personal offer is scheduled for future delivery
4. All status updates are recorded in sheets

### 5. Error Recovery
If any step fails:
1. Error is logged with full stack trace
2. Sheet is updated with failure status
3. Subsequent steps continue if possible
4. Failed operations can be retried manually

## Required Environment Variables

Configure the following secrets in Google Cloud Secret Manager:
- `EMAIL_ENCRYPTION_KEY`
- `SENDGRID_API_KEY`
- `SENDGRID_EMAIL`
- `SEND_GRID_TEMPLATE_FREE_REPORT`
- `SEND_GRID_TEMPLATE_PERSONAL_OFFER`
- `DIRECT_API_KEY` (for Michelle API)
- `SHEETS_ID_FREE_REPORTS_LOG`
- `PUBSUB_SUBSCRIPTION_NAME`
- `GOOGLE_CLOUD_PROJECT_ID`

## Development

1. Set up Google Cloud project and enable required APIs:
   - Cloud PubSub
   - Secret Manager
   - Sheets API
   - SendGrid API

2. Install dependencies:
```bash
npm install
```

3. Start the service:
```bash
npm start
```
The service will start on port 8080 and begin processing messages.

## Deployment

Build and run using Docker:

```bash
docker build -t art-appraisal-crm .
docker run -p 8080:8080 art-appraisal-crm
```