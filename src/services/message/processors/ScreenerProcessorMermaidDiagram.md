# Screener Processing Flow

```mermaid
graph TD
    A[Incoming Screener Notification] --> B[Initialize Processor]
    B --> C[Log Processing Start]
    
    C --> D[Call Email Service]
    D --> D1[Handle Screener Notification]
    
    D1 --> E[Log Success]
    E --> F[Return Success Response]
    
    %% Error handling
    C -.->|Error| G[Log Error]
    D -.->|Error| G
    D1 -.->|Error| G
    G --> H[Throw Error]
```

## Service Interactions

```mermaid
graph TD
    A[ScreenerProcessor] --> B[Email Service]
    B --> C[Handle Screener Notification]
    
    A --> D[Logger]
    D --> E[Log Information]
    D --> F[Log Success]
    D --> G[Log Errors]
```

## Data Flow

```mermaid
sequenceDiagram
    participant Client
    participant Processor as ScreenerProcessor
    participant EmailSvc as Email Service
    participant Logger
    
    Client->>Processor: Send screener notification data
    Processor->>Logger: Log processing start
    
    Processor->>EmailSvc: Handle screener notification
    EmailSvc->>Processor: Return notification result
    
    Processor->>Logger: Log success
    Processor->>Client: Return success response
```

## Error Handling

```mermaid
flowchart TD
    A[Process Start] --> B[Try Process]
    B -->|Success| C[Return Success Response]
    B -->|Error| D[Log Error]
    D --> E[Throw Error]
```

This diagram illustrates the Screener processing flow, which handles incoming screener notifications by delegating to the Email Service to send appropriate notifications. 