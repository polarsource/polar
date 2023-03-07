# Server

## Getting started

```bash
# Run these commands in this directory (./server)
#
# Start PostgreSQL and Redis 
docker compose up -d

# Install dependencies, enter the poetry shell
poetry install
poetry shell

# Run database migrations
make db-migrate

# Fast API backend
uvicorn polar.app:app --reload --workers 1 --port 8000

# (in another terminal) Start the celery worker
celery -A run_worker:app worker

# Run the tests
pytest
```

## Create a database migration

```bash
alembic revision --autogenerate -m "[description]"
```

## Design

Polar started out being structured in modules per function, e.g models, schemas, api endpoints etc. However, a resource and/or service was then scattered across a handful of modules. Inspired by Netflix Dispatch, we've moved to modules per domain(ish) containing all business logic surrounding a given resource/service in one place.

Exception to this rule: Database models and core modules (see more & why below). 



**Great resources and inspirations**

- https://github.com/zhanymkanov/fastapi-best-practices
- https://github.com/Netflix/dispatch



**Standards re: absolute vs. relative imports**

By default we use absolute imports. However, within an isolated module, e.g `polar.organization`, we use relative imports to their corresponding schemas, endpoints, services and the like for better readability and separation. Let's not be fanatical about it and optimize for readability though, e.g do absolute imports vs. deep relative imports.



**How should a module be structured**

| polar/<module>/ | Explanation & Usage                                          |
| --------------- | ------------------------------------------------------------ |
| endpoints.py    | FastAPI `router` for the module. Mounted and routed in `polar.api`. Endpoint functions should be in charge of validation and authentication, but business logic should be contained within `service.py` |
| schemas.py      | Pydantic schemas for request/response and data validation. Resources should have schemas for their applicable CRUD operations named `<Resource>(Read|Create|Update|Delete)` |
| service.py      | Module containing all the business logic. Essentially the non-public API for the resource/service which its own API utilizes along with any other services. |
| signals.py      | Blinker signals (if any). Great way for other services to listen for specific events and do their own thing. |
| receivers.py    | Receiver functions of Blinker signals (if any). Needs to be registered in `polar.receivers` which is mounted ensuring all signals/receivers are setup. |
| exceptions.py   | Any local exceptions.                                        |
| ***             | Not all resources/services are the same. So extend it as needed. |

Of course, only add what's needed for a given resource/service. Once we've finalized this structure and feel we're used to it, we can create a nice little CLI generator :-) 

## FAQ

**Why are database models not in their respective modules vs. `polar.models`?**

Pragmatic solution. Ideally, they would be and `polar.models` could be a global container for them all. The challenge with this is model relationships, e.g `Organization` having many `Repository`, and keeping a feature complete `metadata` object for SQLAlchemy. There are ways around this, but they introduce complexity and some magic that will need to be run at runtime. In short, it creates more problems than it solves.
