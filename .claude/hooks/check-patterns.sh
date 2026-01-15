#!/bin/bash
# Polar pattern enforcement hook
# Runs before Edit/Write tool calls to enforce codebase conventions

# Read JSON from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')
CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // .tool_input.new_string // ""')

# Skip if no file path or content
if [[ -z "$FILE_PATH" ]] || [[ -z "$CONTENT" ]]; then
  echo '{"decision": "approve"}'
  exit 0
fi

# Skip if not a Python file in server/polar/
if [[ ! "$FILE_PATH" =~ server/polar/.* ]] || [[ ! "$FILE_PATH" =~ \.py$ ]]; then
  echo '{"decision": "approve"}'
  exit 0
fi

# Skip migrations - they need different patterns
if [[ "$FILE_PATH" =~ migrations/ ]]; then
  echo '{"decision": "approve"}'
  exit 0
fi

# Check 1: No session.commit() - framework handles commits automatically
if echo "$CONTENT" | grep -q "session\.commit()"; then
  echo '{"decision": "block", "reason": "Never use session.commit() - the framework handles commits automatically at the end of requests/tasks. Use session.flush() if you need data visible before the request ends."}'
  exit 0
fi

# Check 2: No direct DB queries in service files (must be in repository)
if [[ "$FILE_PATH" =~ /service\.py$ ]]; then
  # Check for select() not preceded by sql. (which is our wrapper)
  if echo "$CONTENT" | grep -qE "[^a-z_.]select\(|^select\("; then
    echo '{"decision": "block", "reason": "DB queries (select) must be in repository files, not services. Create a method in the repository and call it from the service."}'
    exit 0
  fi

  # Check for session.execute() - should use repository methods
  if echo "$CONTENT" | grep -q "session\.execute("; then
    echo '{"decision": "block", "reason": "Use repository methods instead of session.execute() in services. Move the query to the repository."}'
    exit 0
  fi

  # Check for session.query() - legacy pattern
  if echo "$CONTENT" | grep -q "session\.query("; then
    echo '{"decision": "block", "reason": "session.query() is a legacy pattern. Use repository methods with SQLAlchemy 2.0 select() syntax."}'
    exit 0
  fi
fi

# All checks passed
echo '{"decision": "approve"}'
