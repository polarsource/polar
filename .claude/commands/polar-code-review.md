# Polar Code Review

Comprehensive code review with 3 specialized agents running in parallel.

## Instructions

1. **Get changed files** by running:
   ```bash
   git diff --name-only main...HEAD
   ```
   If that fails, use `git diff --name-only HEAD~1` or ask the user for the comparison base.

2. **Launch 3 agents IN PARALLEL** using the Task tool. All three must be launched in a SINGLE message with multiple Task tool calls.

### Agent 1: Security Review

```
description: "Security review"
subagent_type: "feature-dev:code-reviewer"
prompt: |
  SECURITY REVIEW for Polar codebase.

  Review these changed files for security vulnerabilities:
  [INSERT CHANGED FILES LIST]

  This is a PAYMENT PLATFORM. Be extra vigilant about:

  1. **SQL Injection**
     - Raw SQL queries with string interpolation
     - Unparameterized queries
     - Dynamic table/column names from user input

  2. **Authentication/Authorization**
     - Missing auth checks on endpoints
     - IDOR (Insecure Direct Object Reference) - accessing resources without verifying ownership
     - Auth subject not properly checked (AuthSubject[User|Organization|Customer])
     - Missing scope checks

  3. **Data Exposure**
     - Sensitive data in logs (tokens, keys, passwords, PII)
     - Sensitive data in API responses that shouldn't be exposed
     - Secrets in error messages

  4. **Input Validation**
     - Missing validation on user input
     - Path traversal possibilities
     - Unsafe deserialization

  5. **Payment-Specific**
     - Race conditions in payment processing
     - Amount manipulation possibilities
     - Missing idempotency checks

  Return findings with:
  - file:line reference
  - Severity: CRITICAL / HIGH / MEDIUM / LOW
  - Description of the issue
  - Suggested fix
```

### Agent 2: Conventions Review

```
description: "Conventions review"
subagent_type: "feature-dev:code-reviewer"
prompt: |
  CONVENTIONS REVIEW for Polar codebase.

  Review these changed files against Polar conventions:
  [INSERT CHANGED FILES LIST]

  **Backend Conventions (server/polar/):**
  - All DB queries MUST be in repository files, not services
  - NEVER call session.commit() - framework handles this
  - Services are singletons (instance at module level: `resource = ResourceService()`)
  - Use AsyncReadSession for reads, AsyncSession for writes
  - Pydantic schemas: separate read, create, update schemas
  - Update schemas: ALL fields must be optional with None default
  - snake_case for all API fields
  - Auth dependencies defined in module's auth.py
  - Use `from_session(session)` to create repository instances
  - Use `get_readable_statement(auth_subject)` for auth-aware queries

  **Frontend Conventions (clients/):**
  - Use design tokens: blue-500, gray-100, polar-800 (dark mode)
  - Always provide dark: variants for colors
  - Border radius: rounded-xl (default), rounded-2xl (large cards)
  - TanStack Query for data fetching
  - Zustand for state management
  - Components in atoms/ or molecules/ directories

  **API Conventions:**
  - POST returns 201 Created
  - PATCH returns 200 OK
  - DELETE returns 204 No Content
  - List endpoints return ListResource with pagination
  - Use PolarRequestValidationError for 422 errors

  Return findings with file:line references.
```

### Agent 3: Simplification Review

```
description: "Simplification review"
subagent_type: "feature-dev:code-reviewer"
prompt: |
  SIMPLIFICATION REVIEW for Polar codebase.

  Review these changed files for opportunities to simplify:
  [INSERT CHANGED FILES LIST]

  Look for:

  1. **Over-engineering**
     - Abstractions used only once
     - Unnecessary wrapper functions
     - Premature generalization

  2. **Complexity**
     - Deep nesting that could use early returns
     - Complex conditionals that could be simplified
     - Long functions that should be split

  3. **Dead Code**
     - Unused imports
     - Unreachable code
     - Commented-out code that should be removed

  4. **Duplication**
     - Copy-pasted logic that could be consolidated
     - Repeated patterns that could be abstracted

  5. **Verbosity**
     - Code that could be more concise
     - Unnecessary variable assignments
     - Redundant type annotations

  **IMPORTANT:** Only flag issues with HIGH confidence. Avoid nitpicking.
  The goal is to catch genuine simplification opportunities, not enforce style preferences.

  Return suggestions with file:line references.
```

3. **Wait for all agents to complete**, then summarize findings.

## Summary Format

Present the combined findings in this format:

---

## Code Review Summary

### 🔴 Security Issues
[List findings from Security Review agent, sorted by severity]
- **CRITICAL**: [description] - `file:line`
- **HIGH**: [description] - `file:line`
- etc.

### 🟡 Convention Violations
[List findings from Conventions Review agent]
- [description] - `file:line`

### 🔵 Simplification Opportunities
[List findings from Simplification Review agent]
- [description] - `file:line`

### Verdict

**✅ APPROVED** - No blocking issues found
or
**❌ CHANGES REQUESTED** - [number] issues must be addressed before merge

---

If there are CRITICAL or HIGH severity security issues, the verdict must be CHANGES REQUESTED.
