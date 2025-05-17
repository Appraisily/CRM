# Gmail Processing Flow

```mermaid
graph TD
    A[Incoming Gmail Interaction] --> B[Initialize Processor]
    B --> C[Log Processing Start]
    
    C --> D[Database Operations]
    D --> D1[Create/Update User]
    D1 --> D2[Record Email Interaction]
    D2 --> D3[Record User Activity]
    
    D3 --> E[Log Success]
    E --> F[Return Success Response]
    
    %% Error handling
    C -.->|Error| G[Log Error]
    D -.->|Error| G
    D1 -.->|Error| G
    D2 -.->|Error| G
    D3 -.->|Error| G
    G --> H[Throw Error]
```

## Database Interactions

```mermaid
graph TD
    A[GmailProcessor] --> B[Database Service]
    
    B --> E[Users Table]
    B --> F[Email Interactions Table]
    B --> G[User Activities Table]
    
    E -->|1. Insert/Update| H[Create or update user record]
    F -->|2. Insert| I[Record email interaction]
    G -->|3. Insert| J[Track user activity]
```

## Data Flow

```mermaid
sequenceDiagram
    participant Client
    participant Processor as GmailProcessor
    participant DB as Database Service
    participant Logger
    
    Client->>Processor: Send Gmail interaction data
    Processor->>Logger: Log processing start
    
    Processor->>DB: Create/update user
    DB->>Processor: Return user ID
    
    Processor->>DB: Record email interaction
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
    D --> E[Throw Error]
```

This diagram illustrates the Gmail processing flow, which handles incoming Gmail interactions by storing user data, email interactions, and activity records in the database. 