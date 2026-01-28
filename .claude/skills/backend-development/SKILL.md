---
name: backend-development
description: Backend development skill for Polar codebase, covering development commands, design and implementation guidelines. Use this skill when the task involves backend coding, API design, or database operations.
license: MIT
metadata:
    author: polar
    version: "1.0.0"
allowed-tools:
    - bash
---

# Backend Development Skill

This skill provides comprehensive guidance for backend development in the Polar codebase, covering REST API design, FastAPI implementation, SQLAlchemy patterns, and backend conventions.

## Scope

This skill assists with:

- **REST API Design**: Endpoint structure, naming conventions, HTTP methods
- **Schema Development**: Pydantic model creation following Polar conventions
- **Service Layer**: Business logic implementation and exception handling
- **Repository Layer**: Database access patterns and SQLAlchemy usage
- **Authentication**: AuthSubject system and scope-based access control
- **Testing**: Test structure, fixtures, and mocking patterns

## Key Principles

1. **REST API Consistency**: Follow Polar's REST API guidelines for endpoint design, schema structure, and response formats
2. **Modular Architecture**: Maintain the established modular structure with endpoints, services, repositories, and schemas
3. **Type Safety**: Use Pydantic schemas for request/response validation and OpenAPI documentation
4. **Proper Layering**: Separate concerns between API endpoints, business logic (services), and data access (repositories)
5. **Authentication**: Use the AuthSubject system for proper access control

## 🔍 When to Use This Skill

**Use this skill when:**

- ✅ Designing new API endpoints
- ✅ Creating or modifying Pydantic schemas
- ✅ Implementing database operations
- ✅ Handling authentication and authorization
- ✅ Following backend coding standards
- ✅ Working with SQLAlchemy patterns
- ✅ Writing tests for backend components

**Don't use this skill for:**

- ❌ Frontend development (React, Next.js)
- ❌ UI/UX design decisions
- ❌ Client-side state management
- ❌ Frontend testing strategies

## Development Commands

## Prerequisites

The commands should be run from the `server/` directory.

The Docker containers should be up and running before executing these commands. Use:

```bash
docker compose up -d
```

## Linting and Type Checking

```bash
# Run linting
uv run task lint

# Run type checking
uv run task lint_types

# Run both linting and type checking
uv run task lint && uv run task lint_types
```

## Testing

```bash
# Run backend tests
uv run task test

# Run specific test module
uv run pytest tests/path/to/module/

# Run tests with coverage
uv run pytest --cov=polar --cov-report=term-missing
```

## Database Operations

```bash
# Run database migrations
uv run task db_migrate

# Generate new migration (from server/ directory)
uv run alembic revision --autogenerate -m "description"

# Create empty migration (from server/ directory)
uv run alembic revision -m "description"
```

## Running the Application

```bash
# Start FastAPI server
uv run task api

# Start Dramatiq background worker
uv run task worker

# Run both API and worker
uv run task api & uv run task worker
```

## REST API Guidelines

This document outlines the guidelines and principles we follow when designing and implementing RESTful APIs at Polar. Adhering to these standards ensures consistency, maintainability, and a better developer experience for both internal and external users of our APIs.

### Overview

- Versioned base path: `/v1/`
- Plural resource names: `/v1/customers/`, `/v1/orders/`
- Standard methods: `GET`, `POST`, `PATCH`, `DELETE`
- Consistent schemas across list and get responses
- No shape-changing parameters (avoid toggling fields on/off in responses)

### Core conventions

- Always use `polar.kit.Schema` (or `TimestampedSchema` when timestamps exist)
- Snake_case field names
- Add docstrings, field descriptions, and meaningful examples
- Separate read/create/update schemas; updates must be partial (all fields optional)
- Validation errors should return `422 Unprocessable Entity` in FastAPI format via `PolarRequestValidationError`

### Schemas

Our schemas are defined in our Python backend using [Pydantic](https://docs.pydantic.dev/latest/) models. Each schema represents a resource to read, create, or update.

**Inherit from `polar.kit.Schema`**

```py theme={null}
# ✅ DO
from polar.kit import Schema

class Customer(Schema):
    email: str

# ❌ DON'T
from pydantic import BaseModel

class Customer(BaseModel):
    email: str
```

**Use snake case for field names**

```py theme={null}
# ✅ DO
class Customer(Schema):
    first_name: str


# ❌ DON'T
class Customer(Schema):
    firstName: str
```

**If the underlying data model includes `created_at` or `updated_at` fields, inherit from `polar.kit.TimestampedSchema`**

```py theme={null}
# ✅ DO
from polar.kit import TimestampedSchema

class Customer(TimestampedSchema):
    email: str

# ❌ DON'T
from polar.kit import Schema

class Customer(Schema):
    email: str
    created_at: datetime
    updated_at: datetime

# ❌ DON'T
from polar.kit import Schema

class Customer(Schema):
    email: str
```

**Add description to schema and fields, and meaningful example values.**

```py theme={null}
# ✅ DO
from polar.kit import Schema
from pydantic import Field

class Customer(Schema):
    """A customer of the platform."""

    email: str = Field(..., description="The customer's email address", example="john@example.com")

# ❌ DON'T
from polar.kit import Schema

class Customer(Schema):
    email: str
```

**Separate read, create, and update schemas**

```py theme={null}
# ✅ DO
class CustomerRead(Schema):
    id: int
    email: str

class CustomerCreate(Schema):
    email: str

class CustomerUpdate(Schema):
    email: str | None = None
```

**Update schemas should support partial updates**

All fields in update schemas should be optional with a default value of `None`, allowing clients to update only the fields they need.

```py theme={null}
# ✅ DO
class CustomerUpdate(Schema):
    email: str | None = None
    first_name: str | None = None

# ❌ DON'T
class CustomerUpdate(Schema):
    email: str
    first_name: str
```

### Endpoints

### Authentication Subjects

All authenticated endpoints should clearly define the authentication subject, which can be one of the following:

- User: An individual user authenticated via PAT, OAuth access token or web session cookie.
- Organization: An organization authenticated via an OAT or OAuth access token.
- Customer: A customer authenticated via a Customer Session.

In most cases, Admin API will support User and Organization subjects, while Customer Portal API will support Customer subjects. It's key then when querying resources to filter upon the authentication subject to ensure proper access control.

#### List endpoints

List endpoints return a list of resources and support filtering, pagination, and sorting.

- **Filtering**: By default, no filter is applied; return all resources the subject can access. Avoid implicit filters like `active=true`. Allow repeated query parameters for multi-value filters:

    ```
    # ✅ DO
    GET /v1/customers/?status=active&status=pending
    ```

- **Pagination**: Page-based with `page` and `limit`.

- **Sorting**: Use `sorting` with comma-separated fields; prefix with `-` for descending:

    ```
    # ✅ DO
    GET /v1/customers/?sorting=-created_at,first_name
    ```

- For endpoints supporting User subject, they'll typically expect an `organization_id` filter to scope results to a specific organization. If not set return resources across all organizations the subject has access to.

- **Response shape**:

    ```json theme={null}
    {
        "items": [
            {
                "id": 1,
                "email": "john@example.com"
            }
        ],
        "pagination": {
            "total_count": 1,
            "max_page": 1
        }
    }
    ```

- Do not add parameters that change the response schema. Use separate endpoints if different representations are needed.

#### Get endpoints

- Retrieve a single resource by its unique identifier (typically ID).
- Response schema matches the list item schema.
- Do not add parameters that change the response schema; prefer separate endpoints for alternate representations.

#### Create endpoints

- Request body uses the create schema.
- On validation errors, return `422 Unprocessable Entity` with FastAPI-style details (`PolarRequestValidationError`).
- On success, return `201 Created` with the read schema.

#### Update endpoints

- Request body uses the update schema (partial updates allowed).
- On validation errors, return `422 Unprocessable Entity` with FastAPI-style details (`PolarRequestValidationError`).
- On success, return `200 OK` with the read schema.

#### Delete endpoints

- Delete an existing resource.
- On success, return `204 No Content` with an empty response body.
