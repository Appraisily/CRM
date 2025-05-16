# IMPORTANT: DO NOT RUN THESE MIGRATIONS AUTOMATICALLY

## Manual Database Management

The SQL files in this directory are for **reference only** and should NOT be run automatically when deploying the service.

All database changes should be performed manually using direct database management tools:

1. Connect to the database using the Cloud SQL console or psql
2. Make changes directly or run SQL scripts after careful review
3. Document any changes in both this folder and the database_schema.md file

## Connection Information

Database Instance: `civil-forge-403609:us-central1:appraisily-db`
Connection Command: `gcloud sql connect appraisily-db --user=postgres`

## Rationale

We've chosen a manual migration approach because:
1. The application runs on Google Cloud SQL, not Supabase
2. Automated migrations might cause unpredictable issues
3. This approach provides greater control over schema changes
4. It prevents potential data loss or service disruption

## Current Schema

See the `database_schema.md` file in the project root for the complete current schema. 