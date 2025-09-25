-- Create read-only user for local development using environment variables
-- Note: PostgreSQL doesn't support environment variable substitution in SQL directly,
-- so we use a shell script approach with envsubst

\set read_user `echo "$POLAR_READ_USER"`
\set read_password `echo "$POLAR_READ_PASSWORD"`
\set database_name `echo "$POSTGRES_DB"`

-- Create read-only user
CREATE USER :read_user WITH PASSWORD :'read_password';

-- Grant connect privilege to the database
GRANT CONNECT ON DATABASE :database_name TO :read_user;

-- Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO :read_user;

-- Grant select on all existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO :read_user;

-- Grant select on all future tables (for when new tables are created)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO :read_user;

-- Grant usage on all sequences (needed for reading tables with serial columns)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO :read_user;

-- Grant usage on all future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO :read_user;
