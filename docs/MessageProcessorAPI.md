# Message Processor API Documentation

This document describes the API endpoints available for getting information about the CRM system's message processors and how to use them.

## Base URL

The CRM system is deployed at:

```
https://crm-856401495068.us-central1.run.app
```

All API endpoints should be prefixed with this base URL.

## Available Endpoints

### List All Processors

Get information about all available message processors and their required schemas. This endpoint **automatically discovers** all registered processors in the system, so it will always return the most up-to-date list without requiring any manual updates to the API.

```
GET /api/docs/processors
```

**Response Example:**

```json
{
  "success": true,
  "data": [
    {
      "type": "screenerNotification",
      "validatorExists": true,
      "schema": {
        "type": "object",
        "properties": {
          "crmProcess": {
            "type": "string",
            "description": "Process identifier",
            "example": "screenerNotification"
          },
          "customer": {
            "type": "object",
            "description": "Customer information",
            "properties": {
              "email": {
                "type": "string",
                "description": "Customer email address"
              }
            },
            "required": ["email"]
          },
          "metadata": {
            "type": "object",
            "description": "Context information",
            "properties": {
              "origin": {
                "type": "string",
                "description": "Origin of the request"
              },
              "sessionId": {
                "type": "string",
                "description": "Unique session identifier"
              },
              "environment": {
                "type": "string",
                "description": "Environment (production, development)"
              },
              "timestamp": {
                "type": "number",
                "description": "Timestamp in milliseconds"
              }
            },
            "required": ["origin", "sessionId", "environment", "timestamp"]
          }
        },
        "required": ["crmProcess", "customer", "metadata"]
      }
    },
    {
      "type": "appraisalReadyNotification",
      "validatorExists": true,
      "schema": {
        "type": "object",
        "properties": {
          "crmProcess": {
            "type": "string",
            "description": "Process identifier",
            "example": "appraisalReadyNotification"
          },
          "customer": {
            "type": "object",
            "description": "Customer information",
            "properties": {
              "email": {
                "type": "string",
                "description": "Customer email address"
              }
            },
            "required": ["email"]
          },
          "metadata": {
            "type": "object",
            "description": "Context information",
            "properties": {
              "origin": {
                "type": "string",
                "description": "Origin of the request"
              },
              "sessionId": {
                "type": "string",
                "description": "Unique session identifier"
              },
              "environment": {
                "type": "string",
                "description": "Environment (production, development)"
              },
              "timestamp": {
                "type": "number",
                "description": "Timestamp in milliseconds"
              }
            },
            "required": ["origin", "sessionId", "environment", "timestamp"]
          },
          "pdf_link": {
            "type": "string",
            "description": "URL to the PDF report"
          },
          "wp_link": {
            "type": "string",
            "description": "URL to the WordPress page"
          }
        },
        "required": ["crmProcess", "customer", "metadata", "pdf_link", "wp_link"]
      }
    }
    // Additional processors...
  ]
}
```

### Get Specific Processor Details

Get detailed information about a specific processor, including an example message. This endpoint automatically generates examples based on the processor's required fields.

```
GET /api/docs/processors/:type
```

Where `:type` is the processor identifier (e.g., `appraisalReadyNotification`).

**Response Example:**

```json
{
  "success": true,
  "data": {
    "type": "appraisalReadyNotification",
    "validatorExists": true,
    "schema": {
      "type": "object",
      "properties": {
        "crmProcess": {
          "type": "string",
          "description": "Process identifier",
          "example": "appraisalReadyNotification"
        },
        "customer": {
          "type": "object",
          "description": "Customer information",
          "properties": {
            "email": {
              "type": "string",
              "description": "Customer email address"
            }
          },
          "required": ["email"]
        },
        "metadata": {
          "type": "object",
          "description": "Context information",
          "properties": {
            "origin": {
              "type": "string",
              "description": "Origin of the request"
            },
            "sessionId": {
              "type": "string",
              "description": "Unique session identifier"
            },
            "environment": {
              "type": "string",
              "description": "Environment (production, development)"
            },
            "timestamp": {
              "type": "number",
              "description": "Timestamp in milliseconds"
            }
          },
          "required": ["origin", "sessionId", "environment", "timestamp"]
        },
        "pdf_link": {
          "type": "string",
          "description": "URL to the PDF report"
        },
        "wp_link": {
          "type": "string",
          "description": "URL to the WordPress page"
        }
      },
      "required": ["crmProcess", "customer", "metadata", "pdf_link", "wp_link"]
    },
    "example": {
      "crmProcess": "appraisalReadyNotification",
      "customer": {
        "email": "customer@example.com",
        "name": "John Doe"
      },
      "metadata": {
        "origin": "api-docs",
        "sessionId": "example-session-123",
        "environment": "development",
        "timestamp": 1684939441234
      },
      "pdf_link": "https://example.com/appraisalReadyNotification/pdf-link-example",
      "wp_link": "https://example.com/appraisalReadyNotification/wp-link-example"
    }
  }
}
```

## Auto-Discovery Feature

The API documentation endpoint is designed to be fully automatic, with these key features:

1. **Automatic Processor Detection**: The endpoint lists all processors registered in the `ProcessorFactory` without any manual configuration.

2. **Automatic Schema Generation**: The endpoint analyzes validator files to identify required fields for each processor.

3. **Automatic Example Generation**: Examples are generated based on the detected schema and field types.

This means that when new processors are added to the system, they will automatically appear in the API documentation with their correct schema and examples without requiring any changes to the documentation endpoint itself.

## Usage

These endpoints are designed to help developers understand what message processors are available in the CRM system and how to format messages for each processor. The API is public and does not require authentication, making it easy to integrate with other services.

### Integration Example

```javascript
// Example of how to fetch available processors
async function getAvailableProcessors() {
  const response = await fetch('https://crm-856401495068.us-central1.run.app/api/docs/processors');
  const data = await response.json();
  return data.data;
}

// Example of how to get details for a specific processor
async function getProcessorDetails(processorType) {
  const response = await fetch(`https://crm-856401495068.us-central1.run.app/api/docs/processors/${processorType}`);
  const data = await response.json();
  return data.data;
}
```

## Notes

- All processors require the `crmProcess`, `customer`, and `metadata` fields
- The `crmProcess` field must match the processor type exactly
- The `metadata.timestamp` must be a number (milliseconds since epoch), not a string
- Each processor may have additional required fields specific to its function 