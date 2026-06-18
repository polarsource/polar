# Server Development Guide

Python/FastAPI backend with PostgreSQL, Redis, and S3 storage.

## Quick Commands

```bash
uv run task api          # Start API server (http://127.0.0.1:8000)
uv run task worker       # Start background worker
uv run task test         # Run tests with coverage
uv run task test_fast    # Faster parallel tests
uv run task lint         # Auto-fix linting
uv run task lint_types   # Type checking with mypy

# Database migrations
uv run alembic revision --autogenerate -m "description"  # Create migration
uv run alembic upgrade head                              # Apply migrations
```

## Module Structure

Each module in `polar/` follows this structure:
```
polar/{module}/
├── __init__.py
├── auth.py           # Authentication dependencies
├── endpoints.py      # FastAPI route handlers
├── service.py        # Business logic (singleton)
├── repository.py     # Database queries (SQLAlchemy)
├── schemas.py        # Pydantic models
├── tasks.py          # Dramatiq background jobs
└── sorting.py        # Sort property enums
```

## Repository Pattern

**ALL database queries MUST be in repository files.**

```python
# polar/{module}/repository.py
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
)

class ResourceRepository(
    RepositorySortingMixin[Resource, ResourceSortProperty],
    RepositorySoftDeletionMixin[Resource],
    RepositoryBase[Resource],
):
    model = Resource

    # Auth-aware query - ALWAYS filter by auth_subject
    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Resource]]:
        statement = self.get_base_statement()
        if is_user(auth_subject):
            statement = statement.where(
                Resource.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Resource.organization_id == auth_subject.subject.id
            )
        return statement

    # Custom query methods
    async def get_by_slug(self, slug: str) -> Resource | None:
        statement = self.get_base_statement().where(Resource.slug == slug)
        return await self.get_one_or_none(statement)
```

**Key methods from base:**
- `get_base_statement()` - Returns `select(self.model)`
- `get_one(statement)` - Single result, raises if not found
- `get_one_or_none(statement)` - Single result or None (calls `.unique()` — safe with `joinedload`)
- `get_all(statement)` - All matching results (calls `.unique()` — safe with `joinedload`)
- `paginate(statement, limit, page)` - Returns (results, count)
- `create(object, flush=False)` - Add to session
- `update(object, update_dict)` - Update fields
- `from_session(session)` - Factory method

**Repository methods use `self.session`, not a `session` parameter.** Once constructed via `from_session(session)`, the session lives on the instance. Don't add a `session` arg to repository methods — pass domain args only. Use `self.session.execute(...)` for raw queries (writes, refreshes), or the base helpers above for selects.

**Subqueries must project explicit columns.** `select(Model).subquery()` re-materializes every mapped column — `deferred=True` does NOT propagate. For count subqueries, use `count_subquery(statement)` from `polar.kit.pagination`; otherwise narrow with `.with_only_columns(...)` before calling `.subquery()`. Enforced by `uv run task lint_subquery`.

## Service Pattern

Services contain business logic and call repositories.

```python
# polar/{module}/service.py
class ResourceService:
    async def list(
        self,
        session: AsyncReadSession,  # READ session for queries
        auth_subject: AuthSubject[User | Organization],
        *,
        pagination: PaginationParams,
        sorting: list[Sorting[ResourceSortProperty]],
    ) -> tuple[Sequence[Resource], int]:
        repository = ResourceRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)
        statement = repository.apply_sorting(statement, sorting)
        return await repository.paginate(statement, pagination.limit, pagination.page)

    async def create(
        self,
        session: AsyncSession,  # WRITE session for mutations
        auth_subject: AuthSubject[User],
        create_schema: ResourceCreate,
    ) -> Resource:
        repository = ResourceRepository.from_session(session)
        resource = await repository.create(Resource(**create_schema.model_dump()))

        # Enqueue background job - NOT session.commit()!
        enqueue_job("resource.created", resource_id=resource.id)

        return resource

# Singleton instance at module level
resource = ResourceService()
```

**CRITICAL: Never call `session.commit()`**
- API: Session commits at end of request automatically
- Workers: Session commits at end of task automatically
- Use `session.flush()` if you need data visible before request ends

## Endpoint Pattern

```python
# polar/{module}/endpoints.py
from polar.kit.pagination import ListResource, Pagination, PaginationParamsQuery

router = APIRouter(prefix="/resources", tags=["resources"])

@router.get("/", response_model=ListResource[ResourceSchema])
async def list_resources(
    auth_subject: auth.ResourcesRead,  # From module's auth.py
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[ResourceSchema]:
    results, count = await resource_service.list(
        session, auth_subject, pagination=pagination, sorting=sorting
    )
    return ListResource(
        items=results,
        pagination=Pagination(page=pagination.page, total_count=count)
    )

@router.post("/", response_model=ResourceSchema, status_code=201)
async def create_resource(
    auth_subject: auth.ResourcesWrite,
    resource_create: ResourceCreate,
    session: AsyncSession = Depends(get_db_session),
) -> Resource:
    return await resource_service.create(session, auth_subject, resource_create)
```

## Authentication

The backend uses a custom auth system built on FastAPI dependency injection. The core type
is `AuthSubject[T]` — the authenticated entity, where `T` is `User`, `Organization`,
`Customer`, or `Anonymous`. An endpoint **without** an `auth_subject` dependency is public.

Credentials resolve in order — customer session token, user session cookie, then API tokens
(OAuth2, Personal Access, Organization Access) — falling back to `Anonymous`. The endpoint's
authenticator then validates the resolved subject type and its scopes. **Scopes** gate
operations: an `Authenticator` declares `required_scopes`, and access is granted if the
subject holds at least one of them.

Define per-module authenticators in the module's `auth.py`:

```python
# polar/{module}/auth.py
from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope

ResourcesRead = Annotated[
    AuthSubject[User | Organization],
    Depends(
        Authenticator(
            required_scopes={Scope.resources_read},
            allowed_subjects={User, Organization},
        )
    ),
]

ResourcesWrite = Annotated[
    AuthSubject[User],
    Depends(
        Authenticator(
            required_scopes={Scope.resources_write},
            allowed_subjects={User},
        )
    ),
]
```

For endpoints used only by the web dashboard or internal backoffice, use the predefined
dependencies from `polar/auth/dependencies.py` instead of defining your own: `WebUser`
(logged-in `AuthSubject[User]`), `WebUserOrAnonymous`, and `AdminUser` (admin privileges).

## Pydantic Schemas

```python
# polar/{module}/schemas.py
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema

class ResourceBase(Schema):
    name: str = Field(description="Resource name")
    slug: str = Field(description="URL-friendly identifier")

class Resource(IDSchema, TimestampedSchema, ResourceBase):
    """Read schema - includes all fields."""
    # `id` comes from IDSchema — don't redeclare `id: UUID4`.
    # Type fields with their enum (e.g. `status: ResourceStatus`), not `str`.

class ResourceCreate(ResourceBase):
    """Create schema - required fields only."""
    pass

class ResourceUpdate(Schema):
    """Update schema - ALL fields optional with None default."""
    name: str | None = None
    slug: str | None = None
```

## Background Tasks

```python
# polar/{module}/tasks.py
from polar.worker import AsyncSessionMaker, TaskPriority, actor, enqueue_job

class ResourceTaskError(PolarTaskError): ...

@actor(actor_name="resource.created", priority=TaskPriority.LOW)
async def resource_created(resource_id: UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = ResourceRepository.from_session(session)
        resource = await repository.get_by_id(resource_id)
        if resource is None:
            raise ResourceDoesNotExist(resource_id)

        # Do work... session commits automatically at end
```

## Testing

Test files mirror the source layout: `polar/{module}/endpoints.py` → `tests/{module}/test_endpoints.py`.
`test_endpoints` and `test_task` are **E2E** — they exercise real behavior (DB, etc.) and don't mock
the unit under test. Reuse existing fixtures (`SaveFixture`, `AsyncSession`, …) and don't re-set data a
fixture already provides. Organize class-based — typically one class per method under test, one test per
scenario, with descriptive names.

### Service Tests (Unit)

```python
# tests/{module}/test_service.py
@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth
    async def test_valid(
        self,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.{module}.service.enqueue_job")

        resource = await resource_service.create(
            session, auth_subject, ResourceCreate(name="Test")
        )

        assert resource.name == "Test"
        enqueue_job_mock.assert_called_once()
```

### API Tests (Integration)

```python
# tests/{module}/test_endpoints.py
@pytest.mark.asyncio
class TestListResources:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/resources/")
        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self, client: AsyncClient, resource: Resource
    ) -> None:
        response = await client.get("/v1/resources/")
        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
```

## Conventions (enforced in review)

Cross-cutting patterns the team enforces in code review. New backend code is expected to follow them.

### Imports
Keep `import` statements at module top, never inside functions or methods. Import models from
`polar.models`, services from their module, and use FastAPI dependency injection for sessions,
repositories, and services.

### Service singletons & imports
Name the singleton the bare domain noun in its module; importers alias it with a `_service` suffix:
```python
# service.py
appeal_case = AppealCaseService()
# caller
from polar.organization_review.appeal_case import appeal_case as appeal_case_service
```

### Creating ORM objects — pass objects, not ids
Set the related ORM object, not its foreign-key id: it's type-safe and populates the relationship in-session.
```python
SupportCaseMessage(case=case, author_user=user)   # ✅
SupportCaseMessage(case_id=case.id, author_user_id=user.id)   # ❌
```
Add the `relationship()` to the model if it doesn't exist yet.

### Relationships are `lazy="raise"`
All relationships use `lazy="raise"`: accessing an unloaded one raises instead of silently emitting a query (no async lazy-load `MissingGreenlet`, no N+1). Eager-load what the request needs:
```python
select(X).options(joinedload(X.rel))   # or selectinload / contains_eager
```
(Populating a backref into an unloaded collection — e.g. `case=case` — is passive and does **not** trigger the raise.)

Exception: a relationship may always eager-load (`lazy="selectin"`/`"joined"`) when there's a legitimate reason to — typically many-to-many association tables.

### Errors → status-coded `PolarError`, not validation errors
Logical/conflict errors are `PolarError` subclasses carrying their own `status_code` (409 conflict, 404 not found; 422 is for request-payload validation only); the global exception handler renders them. Don't catch and re-raise as `PolarRequestValidationError` — that's only for request-*payload* validation (→ 422). Declare them on the endpoint's `responses=` so the OpenAPI client gets the schema:
```python
class CaseClosedError(PolarError):
    def __init__(self) -> None:
        super().__init__("This case is closed.", 409)

@router.post(..., responses={409: {"model": CaseClosedError.schema()}})
```
Always set a proper `status_code` for errors that are normal business operations. The default (500) is still rendered correctly by the handler, **but** Sentry reports it as a hard error — so an expected conflict would page you as if it were a crash.

(Don't add a content-less `422: {"description": ...}` override — it clobbers FastAPI's default `HTTPValidationError` and breaks the generated client.)

### Endpoints return ORM models
Set `response_model` and return the ORM object; FastAPI serializes it via `from_attributes`. Don't hand-build the read schema — except when a field is *derived* and not on the model (then `Schema.model_validate({...})`).
```python
@router.post(..., response_model=ResourceSchema)
async def create(...) -> Resource:   # ORM model, not the schema
    return await resource_service.create(...)
```

## Tax ID Validation

When adding or modifying tax ID validators in `polar/tax/tax_id.py`:
- Keep validators minimal — no lengthy docstrings; the code should be self-explanatory.
- Follow existing patterns (e.g. `CLTINValidator`, `TRTINValidator`).
- Use the `stdnum` library when a module exists for the tax ID type.
- Add a few representative valid-format tests and only one invalid case per type — no excessive negatives.

## Key Files Reference

- Repository base: `polar/kit/repository/base.py`
- Auth models: `polar/auth/models.py`
- Pagination: `polar/kit/pagination.py`
- Worker: `polar/worker.py`
- Example module: `polar/organization/`
