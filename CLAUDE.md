# CRM Service Development Guidelines

## Commands
- Build: `npm run build` (transpiles TypeScript to JavaScript)
- Start: `npm run start` (runs built JavaScript)
- Development: `npm run dev` (runs with ts-node)
- Watch mode: `npm run watch` (watches for changes and rebuilds)

## Code Style Guidelines
- **TypeScript**: Use strict typing with interfaces/types for all objects
- **Error Handling**: Use custom error classes (AppError, ValidationError, ProcessingError)
- **Naming Conventions**: 
  - Classes: PascalCase (BaseMessageProcessor)
  - Methods/variables: camelCase
  - Constants: UPPER_SNAKE_CASE
- **Logging**: Use Logger class for consistent logging across components
- **Imports**: Group imports by external packages, then internal modules
- **Message Processing**: Follow Factory pattern for processor creation
- **REST APIs**: Use RESTful conventions with proper status codes
- **Authentication**: Implement validateApiKey middleware for secured routes
- **API Responses**: Consistent JSON response format with success/error fields
- **Environment Variables**: Access via process.env, validate at startup

Remember to run TypeScript checks before committing changes.