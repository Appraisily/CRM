# Appraisal Ready Notification Processing Flow

```mermaid
graph TD
    A[Incoming Appraisal Ready Request] --> B[Initialize Processor]
    B --> C[Log Processing Start]
    
    C --> D[Validate Required Data]
    D --> E[Create/Update User]
    E --> F[Update Appraisal Status]
    F --> G[Send Notification Email]
    G --> H[Record Email Interaction]
    H --> I[Record User Activity]
    I --> J[Log Success]
    J --> K[Return Success Response]
    
    %% Error handling
    C -.->|Error| L[Log Error]
    D -.->|Error| L
    E -.->|Error| L
    F -.->|Error| L
    G -.->|Error| L
    H -.->|Error| L
    I -.->|Error| L
    L --> M[Return Error Response]
```

## Database Interactions

```mermaid
graph TD
    A[AppraisalReadyNotificationProcessor] --> B[Database Service]
    A --> C[Email Service]
    
    B --> D[Users Table]
    B --> E[Appraisals Table]
    B --> F[Email Interactions Table]
    B --> G[User Activities Table]
    
    D -->|1. Insert/Update| H[Create or update user record]
    E -->|2. Update| I[Update appraisal status to completed]
    F -->|3. Insert| J[Record email interaction]
    G -->|4. Insert| K[Track user activity]
    
    C -->|Send| L[Notification Email]
```

## Data Flow

```mermaid
sequenceDiagram
    participant Client
    participant Processor as AppraisalReadyNotificationProcessor
    participant DB as Database Service
    participant Email as Email Service
    participant Logger
    
    Client->>Processor: Send appraisal ready data
    Processor->>Logger: Log processing start
    
    Processor->>Processor: Validate required data
    
    Processor->>DB: Create/update user
    DB->>Processor: Return user ID
    
    Processor->>DB: Update appraisal status
    
    Processor->>Email: Send notification email
    Email->>Processor: Return email result
    
    Processor->>DB: Record email interaction
    DB->>Processor: Return email interaction ID
    
    Processor->>DB: Record user activity
    
    Processor->>Logger: Log success
    Processor->>Client: Return success response
```

## Error Handling

```mermaid
flowchart TD
    A[Process Start] --> B[Try Process]
    B -->|Success| C[Return Success Response]
    B -->|Error| D[Log Error]
    D --> E[Return Error Response with Details]
```

## Expected Input Format

```json
{
  "customer": {
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "appraisal": {
    "id": "apr_12345",
    "sessionId": "sess_67890",
    "reportUrl": "https://dashboard.example.com/appraisals/apr_12345/report",
    "type": "standard",
    "itemDescription": "Vintage Watch",
    "estimatedValue": "$1,500",
    "completedDate": "2023-06-15T14:30:00.000Z",
    "imageUrl": "https://storage.example.com/appraisal-images/item123.jpg"
  },
  "metadata": {
    "origin": "web",
    "environment": "production",
    "timestamp": "2023-06-15T14:35:00.000Z"
  }
}
```

This diagram illustrates the appraisal ready notification process flow, which updates the appraisal status in the database, sends a notification email to the customer, and records all relevant interactions. 