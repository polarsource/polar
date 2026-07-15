#!/bin/bash
# Polar pattern enforcement hook
# Runs before file-editing tool calls to enforce codebase conventions

block() {
  echo "$1" >&2
  exit 2
}

check_content() {
  local file_path="$1"
  local content="$2"

  if [[ -z "$file_path" ]] || [[ -z "$content" ]]; then
    return
  fi

  if [[ ! "$file_path" =~ server/polar/.* ]] || [[ ! "$file_path" =~ \.py$ ]]; then
    return
  fi

  if [[ "$file_path" =~ migrations/ ]]; then
    return
  fi

  if printf '%s\n' "$content" | grep -q "session\.commit()"; then
    block "Never use session.commit() - the framework handles commits automatically at the end of requests/tasks. Use session.flush() if you need data visible before the request ends."
  fi

  if [[ "$file_path" =~ /service\.py$ ]] && [[ ! "$file_path" =~ metrics/service\.py$ ]]; then
    if printf '%s\n' "$content" | grep -qE "[^a-z_.]select\(|^select\("; then
      block "DB queries (select) must be in repository files, not services. Create a method in the repository and call it from the service."
    fi

    if printf '%s\n' "$content" | grep -q "session\.execute("; then
      block "Use repository methods instead of session.execute() in services. Move the query to the repository."
    fi

    if printf '%s\n' "$content" | grep -q "session\.query("; then
      block "session.query() is a legacy pattern. Use repository methods with SQLAlchemy 2.0 select() syntax."
    fi
  fi
}

INPUT=$(cat)
TOOL_NAME=$(printf '%s\n' "$INPUT" | jq -r '.tool_name // ""')

if [[ "$TOOL_NAME" == "apply_patch" ]]; then
  PATCH=$(printf '%s\n' "$INPUT" | jq -r '.tool_input.command // ""')
  FILE_COUNT=0

  while IFS= read -r -d $'\034' FILE_PATH && IFS= read -r -d $'\034' CONTENT; do
    FILE_COUNT=$((FILE_COUNT + 1))
    check_content "$FILE_PATH" "$CONTENT"
  done < <(
    printf '%s\n' "$PATCH" | awk '
      function emit() {
        if (file_path != "") {
          printf "%s\034%s\034", file_path, content
          file_path = ""
          content = ""
        }
      }

      /^\*\*\* (Add|Update) File: / {
        emit()
        file_path = $0
        sub(/^\*\*\* (Add|Update) File: /, "", file_path)
        next
      }

      /^\*\*\* Delete File: / {
        emit()
        file_path = $0
        sub(/^\*\*\* Delete File: /, "", file_path)
        emit()
        next
      }

      /^\*\*\* Move to: / {
        file_path = $0
        sub(/^\*\*\* Move to: /, "", file_path)
        next
      }

      /^\*\*\* End Patch/ {
        emit()
        next
      }

      file_path != "" && /^\+/ {
        content = content substr($0, 2) "\n"
      }

      END { emit() }
    '
  )

  if [[ "$FILE_COUNT" -eq 0 ]]; then
    block "Unable to inspect apply_patch input."
  fi

  exit 0
fi

FILE_PATH=$(printf '%s\n' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')
CONTENT=$(printf '%s\n' "$INPUT" | jq -r '.tool_input.content // .tool_input.new_string // ""')
check_content "$FILE_PATH" "$CONTENT"
