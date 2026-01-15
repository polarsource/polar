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
- `get_one_or_none(statement)` - Single result or None
- `get_all(statement)` - All matching results
- `paginate(statement, limit, page)` - Returns (results, count)
- `create(object, flush=False)` - Add to session
- `update(object, update_dict)` - Update fields
- `from_session(session)` - Factory method

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

## Auth Dependencies

```python
# polar/{module}/auth.py
from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope

ResourcesRead = Annotated[
    AuthSubject[User | Organization],
    Depends(
        Authenticator(
            required_scopes={Scope.web_read, Scope.resources_read},
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

## Pydantic Schemas

```python
# polar/{module}/schemas.py
from polar.kit.schemas import Schema, TimestampedSchema

class ResourceBase(Schema):
    name: str = Field(description="Resource name")
    slug: str = Field(description="URL-friendly identifier")

class Resource(TimestampedSchema, ResourceBase):
    """Read schema - includes all fields."""
    id: UUID4

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

## Key Files Reference

- Repository base: `polar/kit/repository/base.py`
- Auth models: `polar/auth/models.py`
- Pagination: `polar/kit/pagination.py`
- Worker: `polar/worker.py`
- Example module: `polar/organization/`
