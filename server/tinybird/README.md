# Tinybird SQL Linting

This directory contains Tinybird datasources and pipes for ClickHouse event tracking.

## SQLFluff Setup

We use [SQLFluff](https://sqlfluff.com/) to lint the SQL queries in our Tinybird `.pipe` files.

### Running the Linter

From the `server/` directory, run:

```bash
uv run task lint_sql
```

This will:
1. Extract SQL queries from all `.pipe` files in the `tinybird/` directory
2. Run SQLFluff with the ClickHouse dialect on each query
3. Report any linting issues

### Configuration

SQLFluff is configured in `server/.sqlfluff` with:
- **Dialect**: ClickHouse
- **Excluded rules**: Some rules are disabled to accommodate ClickHouse-specific syntax and Tinybird file format:
  - `CP03`: ClickHouse uses camelCase for aggregate state functions (`countState`, `minState`, etc.)
  - `LT12`: Tinybird format doesn't require trailing newlines in SQL sections
  - Other rules excluded for ClickHouse compatibility

### How It Works

Tinybird `.pipe` files have a custom format with metadata and SQL mixed together. The SQL content appears after a `SQL >` marker. We use a custom script (`scripts/lint_tinybird_sql.py`) to:

1. Parse `.pipe` files and extract SQL sections
2. Create temporary `.sql` files for linting
3. Run SQLFluff on the extracted SQL
4. Report results with original file paths

### Dependencies

SQLFluff is installed as a dev dependency in `pyproject.toml`:

```toml
[dependency-groups]
dev = [
  ...
  "sqlfluff>=4.0.0",
  ...
]
```

### Example Output

```
Found 5 .pipe files to lint

================================================================================
SQLFluff Linting Results
================================================================================

✓ tinybird/pipes/event_types_by_customer_id_mv.pipe: PASS
✓ tinybird/pipes/event_types_by_external_customer_id_mv.pipe: PASS
✓ tinybird/pipes/event_types_mv.pipe: PASS
✓ tinybird/pipes/events_by_timestamp_mv.pipe: PASS
✓ tinybird/pipes/subscription_state_mv.pipe: PASS

Summary: 5 passed, 0 failed out of 5 files
```

## File Structure

- `datasources/` - Tinybird datasource definitions with table schemas
- `pipes/` - Tinybird materialized view pipes with SQL queries
