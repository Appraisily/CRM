# Art Appraisal CRM Service

A dedicated Node.js service for handling customer relationship management (CRM) and communications for the Art Appraisal platform. This service processes PubSub messages to trigger customer communications, manage email campaigns, and handle customer interactions.

## Overview

This service is part of a microservices architecture where:
- Analysis and processing are handled by separate services
- This CRM service focuses solely on customer communications
- Communication workflows are triggered by Google Cloud PubSub messages
- All customer data and interaction history are tracked and logged

## Core Features

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

When a screener notification message is received, the service follows this exact process:

### 1. Message Reception and Validation
```json
{
  "crmProcess": "screenerNotification",
  "customer": {
    "email": "customer@example.com"
  },
  "origin": "screener",
  "timestamp": 1703187654321,
  "sessionId": "uuid-v4-session-id",
  "metadata": {
    "analysisId": "uuid-v4-session-id",
    "source": "analysis-backend",
    "imageUrl": "https://storage.googleapis.com/bucket-name/sessions/uuid/UserUploadedImage.jpg",
    "originalName": "artwork.jpg",
    "analyzed": true,
    "originAnalyzed": false
  }
}
```

### 2. Process Flow
1. **Message Validation**
   - Validates message structure and required fields
   - Decodes base64-encoded message data
   - Logs receipt of message with key details

2. **Sheet Logging**
   - Creates or updates row in tracking sheet
   - Records customer email and submission time
   - Marks communication type as "Screener"

3. **Free Report Generation**
   - Composes initial analysis report
   - Uses available metadata
   - Creates HTML email content
   - Sends via SendGrid
   - Updates sheet with delivery status

4. **Personal Offer Scheduling**
   - Schedules offer for 1 hour after notification
   - Generates personalized content via Michelle API
   - Uses SendGrid's scheduled delivery
   - Records scheduled status in sheet

### 3. Sheet Structure
The service maintains a detailed log in Google Sheets with the following columns:

```
A: Timestamp
B: Session ID
C: Email
D: Communication Type
E: Delivery Status
F: Delivery Time
G: Content Type
H: Content Hash
I: Offer Status
J: Offer Time
K: Offer Content
L: Free Report Status
M: Free Report Time
N: Offer Status
O: Offer Time
P: Offer Content
```

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

## PubSub Setup

1. Create the topic:
```bash
gcloud pubsub topics create CRM-tasks
```

2. Create push subscription:
```bash
gcloud pubsub subscriptions create CRM-tasks \
  --topic=CRM-tasks \
  --push-endpoint=https://crm-856401495068.us-central1.run.app/push-handler \
  --ack-deadline=10
```

## Development

1. Set up Google Cloud project and enable required APIs:
   - Cloud PubSub
   - Secret Manager
   - Sheets API

2. Install dependencies:
```bash
npm install
```

3. Start the service:
```bash
npm start
```

The service will start listening for PubSub messages on port 8080.

## Docker Support

Build and run using Docker:

```bash
docker build -t art-appraisal-crm .
docker run -p 8080:8080 art-appraisal-crm
```