# CRM Service Development Guidelines

## Commands
- Build: `npm run build` (transpiles TypeScript to JavaScript)
- Start: `npm run start` (runs built JavaScript)
- Development: `npm run dev` (runs with ts-node)
- Watch mode: `npm run watch` (watches for changes and rebuilds)
- Typecheck: `npx tsc --noEmit` (check TypeScript without transpiling)
- Deploy: `gcloud run deploy crm --source .` (deploy to Google Cloud Run)

## Code Style Guidelines
- **TypeScript**: Use strict typing with interfaces/types for all objects
- **Error Handling**: Use custom error classes (AppError, ValidationError, ProcessingError)
- **Naming Conventions**: 
  - Classes: PascalCase (BaseMessageProcessor)
  - Methods/variables: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Files: camelCase for regular files, PascalCase for classes
- **Logging**: Use Logger class for consistent logging across components
- **Imports**: Group imports in order: external packages → internal modules
- **Message Processing**: Follow Factory pattern for processor creation
- **REST APIs**: Use RESTful conventions with proper status codes
- **Authentication**: Implement validateApiKey middleware for secured routes
- **API Responses**: Consistent JSON response format with success/error fields
- **Environment Variables**: Access via process.env, validate at startup
- **Testing**: Add tests for all new processors and API endpoints

Always run `npm run build` before committing changes to validate TypeScript.