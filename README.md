# CRM System for Art Appraisal Services

A Node.js Express backend service that manages customer relationships, processes appraisals, handles communications, and integrates with various Google Cloud services.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Core Features](#core-features)
- [Project Structure](#project-structure)
- [Data Models](#data-models)
- [API Endpoints](#api-endpoints)
- [Services](#services)
- [Authentication & Security](#authentication--security)
- [Configuration](#configuration)
- [Development](#development)
- [Deployment](#deployment)
- [Error Handling](#error-handling)

## Architecture Overview

This CRM system follows a modular microservices architecture where:

- **Express Server**: Main API handling HTTP requests for customer data and operations
- **PubSub Messaging**: Asynchronous message processing using a pull subscription model
- **PostgreSQL Database**: Customer and interaction data storage via Prisma ORM
- **Google Cloud Storage**: Image and file storage for appraisals
- **SendGrid**: Email service integration for customer communications
- **OpenAI**: AI integration for appraisal analysis
- **Google Sheets**: Additional logging and tracking

## Core Features

- **Customer Management**: Track customer profiles, activities, and interactions
- **Message Processing**: Handle PubSub messages for various operations
- **Email Communications**: Automated, templated communication with customers
- **Appraisal Processing**: Manage art appraisal workflows and reporting
- **Security**: API key authentication, encryption, and rate limiting
- **Data Tracking**: Comprehensive logging and data management

## Project Structure

```
├── index.js                # Main entry point
├── Dockerfile              # Container configuration for Cloud Run
├── prisma/                 # Database schema and migrations
│   └── schema.prisma       # Prisma data models
├── src/
│   ├── config/             # Configuration and initialization
│   ├── middleware/         # Express middleware (CORS, auth, etc.)
│   ├── routes/             # API route definitions
│   │   ├── customers.js    # Customer API endpoints
│   │   └── email.js        # Email management endpoints
│   ├── services/           # Core service modules
│   │   ├── database/       # Database connection and operations
│   │   ├── email/          # Email service using SendGrid
│   │   ├── encryption.js   # Data security and encryption
│   │   ├── message/        # PubSub message handling
│   │   ├── openai.js       # OpenAI integration for appraisals
│   │   ├── pubsub/         # PubSub client and subscription
│   │   ├── reportComposer.js # Generates appraisal reports
│   │   ├── sheets/         # Google Sheets integration
│   │   └── storage.js      # Google Cloud Storage operations
│   ├── templates/          # Email templates and content
│   └── utils/              # Utility functions and helpers
```

## Data Models

The system uses Prisma ORM with the following main models:

### User Model
Core user information with email and activity tracking.

### UserActivity
Tracks various user interactions including:
- Chat sessions
- Email communications
- Purchases
- Appraisals
- Website visits

### ChatSession
Manages customer support and sales interactions with agents.

### Purchase
Tracks service purchases, payment information, and status.

### Appraisal
Stores appraisal requests, results, and processing status.

### EmailInteraction
Records all email communications with customers.

## API Endpoints

The system provides RESTful API endpoints for customer data:

### Customer Endpoints

```
GET /api/customers/:email           # Get customer profile
GET /api/customers/:email/activities # Get customer activities
GET /api/customers/:email/purchases  # Get purchase history
GET /api/customers/:email/appraisals # Get appraisal history
```

### Email Endpoints

```
POST /api/email/send-report         # Send appraisal report
POST /api/email/send-offer          # Send personalized offer
```

### Health Check

```
GET /health                         # Service health status
```

## Services

### Database Service
Manages PostgreSQL connections and operations through Prisma.

### Storage Service
Handles file uploads and retrieval from Google Cloud Storage.

### Email Service
Manages email communications through SendGrid with templates for:
- Free reports
- Personal offers
- Registration notifications
- Password resets

### PubSub Service
Processes messages from Google Cloud PubSub including:
- Appraisal requests
- Payment notifications
- Email interactions
- Chat summaries

### Report Composer
Generates detailed appraisal reports based on image analysis and AI processing.

### OpenAI Service
Integrates with OpenAI for art analysis and description generation.

### Encryption Service
Provides data security using AES-256-GCM encryption.

## Authentication & Security

- **API Authentication**: Uses API keys stored in Secret Manager
- **Rate Limiting**: Prevents abuse with express-rate-limit
- **Data Encryption**: Secures sensitive information with encryption
- **Password Hashing**: Uses Argon2 for secure password storage
- **CORS Protection**: Restricts access to approved domains

## Configuration

The application uses Google Secret Manager for configuration instead of environment files:

### Secret Manager Secrets
- `GOOGLE_CLOUD_PROJECT_ID`: GCP project ID
- `GCS_BUCKET_NAME`: Google Cloud Storage bucket
- `OPENAI_API_KEY`: API key for OpenAI
- `SENDGRID_API_KEY`: API key for SendGrid
- `SENDGRID_EMAIL`: From email address
- `SEND_GRID_TEMPLATE_FREE_REPORT`: Email template ID
- `SEND_GRID_TEMPLATE_PERSONAL_OFFER`: Email template ID
- `DIRECT_API_KEY`: API key for direct service access
- `EMAIL_ENCRYPTION_KEY`: Encryption key for email data
- `SHEETS_ID_FREE_REPORTS_LOG`: Google Sheets ID

### Runtime Variables
- `PORT`: Server port (defaults to 8080)
- `PUBSUB_SUBSCRIPTION_NAME`: PubSub subscription name
- `DATABASE_INSTANCE_UNIX_SOCKET`: Database connection string

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up local configuration:
   - Create service account with necessary permissions
   - Configure Secret Manager access
   - Set up local PostgreSQL database
4. Start the service:
   ```bash
   npm start
   ```

## Deployment

The application is built and deployed on Google Cloud Run:

1. Build the container:
   ```bash
   docker build -t gcr.io/[PROJECT_ID]/crm-service .
   ```

2. Push to Google Container Registry:
   ```bash
   docker push gcr.io/[PROJECT_ID]/crm-service
   ```

3. Deploy to Cloud Run with appropriate configuration:
   - Set PUBSUB_SUBSCRIPTION_NAME runtime variable
   - Configure service account with required permissions
   - Configure Secret Manager access
   - Set appropriate memory and CPU limits

## Error Handling

The service implements comprehensive error handling:
- Graceful shutdown with SIGTERM and SIGINT handlers
- Uncaught exception and unhandled rejection handling
- Logging via dedicated Logger utility
- Database connection pool management
- Automatic PubSub subscription cleanup
- Service health monitoring endpoint