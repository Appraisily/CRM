# Appraisal Ready Notification Integration Guide

This guide explains how to integrate with the CRM system's Appraisal Ready Notification processor using Google Cloud Pub/Sub messaging.

## Overview

When an appraisal report is completed and ready for a customer, your service needs to send a notification message to the CRM system. The CRM will then:

1. Update the appraisal status in the database
2. Send an email notification to the customer using the SendGrid template
3. Record the email interaction and user activity in the CRM database

## Prerequisites

- Google Cloud project access with Pub/Sub permissions
- Google Cloud SDK installed (for local testing)
- Service account credentials with Pub/Sub publish permissions

## Message Schema

The CRM system follows a standard message schema structure for all processors. For the Appraisal Ready Notification, your message must adhere to the following format:

```json
{
  "crmProcess": "appraisalReadyNotification",  // Required - MUST be exactly this value
  "customer": {                                // Required object
    "email": "customer@example.com",           // Required
    "name": "John Doe"                         // Optional, defaults to 'Customer'
  },
  "metadata": {                                // Required object
    "origin": "appraisal-service",             // Required - Identifies the sending system
    "sessionId": "sess_67890",                 // Required - The appraisal session ID
    "environment": "production",               // Required - "production", "development", etc.
    "timestamp": 1686839700000                 // Required - Milliseconds since epoch (numeric)
  },
  "pdf_link": "https://example.com/appraisals/report.pdf",  // Required for this processor
  "wp_link": "https://example.com/appraisals/vintage-watch"  // Required for this processor
}
```

### Critical Schema Notes

1. The `crmProcess` field **MUST** be exactly "appraisalReadyNotification" (case-sensitive)
2. All messages must include `customer` and `metadata` objects with their required fields
3. The `metadata.timestamp` must be a number (milliseconds since epoch), not a string
4. Both `pdf_link` and `wp_link` are required fields specific to this processor

## Implementation Steps

### 1. Install Required Dependencies

For Node.js projects:

```bash
npm install @google-cloud/pubsub
```

For Python projects:

```bash
pip install google-cloud-pubsub
```

### 2. Configure Environment Variables

Add these environment variables to your service:

```
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
PUBSUB_TOPIC_CRM_MESSAGES=crm-messages
```

### 3. Create a PubSub Client

#### Node.js Example

```javascript
const { PubSub } = require('@google-cloud/pubsub');

// Create a client
const pubsub = new PubSub({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const topic = pubsub.topic(process.env.PUBSUB_TOPIC_CRM_MESSAGES);
```

#### Python Example

```python
from google.cloud import pubsub_v1
import os

# Create a publisher client
publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(
    os.environ.get('GOOGLE_CLOUD_PROJECT'),
    os.environ.get('PUBSUB_TOPIC_CRM_MESSAGES')
)
```

### 4. Implement the Message Publishing Function

#### Node.js Example

```javascript
async function sendAppraisalReadyNotification(data) {
  try {
    const now = Date.now(); // Current timestamp in milliseconds
    
    // Prepare message data structure following the required schema
    const messageData = {
      crmProcess: 'appraisalReadyNotification',  // Required process identifier
      
      customer: {
        email: data.customerEmail,  // Required
        name: data.customerName || 'Customer'  // Optional
      },
      
      metadata: {
        origin: 'appraisal-service',  // Identifies your system
        sessionId: data.sessionId,  // Required
        environment: process.env.NODE_ENV || 'production',  // Required
        timestamp: now  // MUST be a number (milliseconds)
      },
      
      // Processor-specific required fields
      pdf_link: data.pdfUrl,
      wp_link: data.wordpressUrl
    };

    // Convert to a buffer for publishing
    const messageBuffer = Buffer.from(JSON.stringify(messageData));
    
    // Publish the message
    const messageId = await topic.publish(messageBuffer);
    
    console.log(`Appraisal ready notification sent, message ID: ${messageId}`);
    return messageId;
  } catch (error) {
    console.error('Failed to send appraisal ready notification:', error);
    throw error;
  }
}
```

#### Python Example

```python
def send_appraisal_ready_notification(data):
    try:
        now = int(time.time() * 1000)  # Current timestamp in milliseconds
        
        # Prepare message data structure following the required schema
        message_data = {
            "crmProcess": "appraisalReadyNotification",  # Required process identifier
            
            "customer": {
                "email": data["customer_email"],  # Required
                "name": data.get("customer_name", "Customer")  # Optional
            },
            
            "metadata": {
                "origin": "appraisal-service",  # Identifies your system
                "sessionId": data["session_id"],  # Required
                "environment": os.environ.get("ENVIRONMENT", "production"),  # Required
                "timestamp": now  # MUST be a number (milliseconds)
            },
            
            # Processor-specific required fields
            "pdf_link": data["pdf_url"],
            "wp_link": data["wordpress_url"]
        }
        
        # Convert to JSON string and encode
        message_json = json.dumps(message_data)
        message_bytes = message_json.encode('utf-8')
        
        # Publish the message
        future = publisher.publish(topic_path, data=message_bytes)
        message_id = future.result()
        
        print(f"Appraisal ready notification sent, message ID: {message_id}")
        return message_id
    except Exception as e:
        print(f"Failed to send appraisal ready notification: {e}")
        raise
```

### 5. Usage in Your Application

Here's how to call the function from your application when an appraisal is ready:

#### Node.js Example

```javascript
// When your appraisal report is ready
app.post('/appraisals/:id/complete', async (req, res) => {
  try {
    const appraisalId = req.params.id;
    const appraisal = await getAppraisalDetails(appraisalId);
    
    // Generate URLs for the report
    const pdfUrl = `https://your-service.com/appraisals/${appraisalId}/report.pdf`;
    const wordpressUrl = `https://your-site.com/appraisals/${appraisalId}`;
    
    // Send notification
    await sendAppraisalReadyNotification({
      customerEmail: appraisal.customerEmail,
      customerName: appraisal.customerName,
      sessionId: appraisal.sessionId,
      pdfUrl: pdfUrl,
      wordpressUrl: wordpressUrl
    });
    
    res.status(200).json({ success: true, message: 'Notification sent' });
  } catch (error) {
    console.error('Error completing appraisal:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

#### Python Example

```python
@app.route('/appraisals/<appraisal_id>/complete', methods=['POST'])
def complete_appraisal(appraisal_id):
    try:
        appraisal = get_appraisal_details(appraisal_id)
        
        # Generate URLs for the report
        pdf_url = f"https://your-service.com/appraisals/{appraisal_id}/report.pdf"
        wordpress_url = f"https://your-site.com/appraisals/{appraisal_id}"
        
        # Send notification
        send_appraisal_ready_notification({
            "customer_email": appraisal["customer_email"],
            "customer_name": appraisal["customer_name"],
            "session_id": appraisal["session_id"],
            "pdf_url": pdf_url,
            "wordpress_url": wordpress_url
        })
        
        return jsonify({"success": True, "message": "Notification sent"})
    except Exception as e:
        app.logger.error(f"Error completing appraisal: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
```

## Testing Your Implementation

### 1. Verify the Topic Exists

```bash
gcloud pubsub topics list | grep crm-messages
```

If it doesn't exist, create it:

```bash
gcloud pubsub topics create crm-messages
```

### 2. Send a Test Message

#### Using gcloud CLI

```bash
gcloud pubsub topics publish crm-messages --message='{
  "crmProcess": "appraisalReadyNotification",
  "customer": {
    "email": "test@example.com",
    "name": "Test User"
  },
  "metadata": {
    "origin": "manual-test",
    "sessionId": "test_session_123",
    "environment": "development",
    "timestamp": '$(date +%s%N | cut -b1-13)'
  },
  "pdf_link": "https://example.com/test-report.pdf",
  "wp_link": "https://example.com/test-report"
}'
```

### 3. Check Logs in the CRM System

After sending a test message, check the logs in the CRM system to verify that the message was received and processed correctly.

## Troubleshooting

### Common Issues

1. **Invalid Process Type**: The `crmProcess` field must be exactly "appraisalReadyNotification".
2. **Missing Required Fields**: Make sure all required fields are included.
3. **Timestamp Format**: Ensure the timestamp is a number (milliseconds), not a string.
4. **Permission Denied**: Ensure your service account has the `roles/pubsub.publisher` role.
5. **Topic Not Found**: Verify the topic name is correct and exists in your GCP project.

### Getting Help

If you encounter issues with this integration, please contact the CRM system administrators with:

1. The message ID (if available)
2. Timestamp of the attempted publication
3. Any error messages received
4. Sample of the message data (with sensitive information removed)

## Security Considerations

- Do not include sensitive customer information beyond what's required
- Ensure all URLs use HTTPS
- Rotate service account credentials periodically
- Monitor Pub/Sub usage to detect unusual patterns

---

For additional assistance or to request enhancements to this integration, please contact the CRM team. 