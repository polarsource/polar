# Server

## Getting started

Before running Polar locally (specifically the API), you should set up a [GitHub app](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)
and require necessary permissions. For a list of permissions needed, have a look
at [this file](https://github.com/polarsource/polar/blob/main/server/polar/integrations/github/verify.py#L16).
You can then run ``poetry run task verify_github_app`` to verify everything is okay then run the commands below.

```bash
# Run these commands in this directory (./server)
#
# Create a .env file and edit it
cp .env.template .env

# Start PostgreSQL and Redis
docker compose up -d

# Install dependencies, enter the poetry shell
poetry install
poetry shell

# Checkout what powers are in the toolbelt
poetry run task --list

# Use our VSCode workspace (extensions, settings etc)
code polar.code-workspace

# Run database migrations
poetry run task db_migrate

# Fast API backend
poetry run task api

# (in another terminal) Start the arq worker
poetry run task worker

# Run the tests
poetry run task test

# Our VSCode settings configure Ruff, but you can run it manually too
poetry run task lint

```

## Create a database migration

Modify the model in polar.model, then run

```bash
alembic revision --autogenerate -m "[description]"
```

and a migration will be generated for you.

## Design

Polar started out being structured in modules per function, e.g models, schemas, api endpoints etc. However, a resource and/or service was then scattered across a handful of modules. Inspired by Netflix Dispatch, we've moved to modules per domain(ish) containing all business logic surrounding a given resource/service in one place.

Exception to this rule: Database models and core modules (see more & why below).

<img width="1014" alt="Screenshot 2023-03-13 at 08 40 23" src="https://user-images.githubusercontent.com/281715/224637060-d54c9144-df78-4d3e-ac74-d7e39a5a202e.png">

**How a module is structured**

| polar/your_module/ | Explanation & Usage                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| endpoints.py       | FastAPI `router` for the module. Mounted and routed in `polar.api`. Endpoint functions should be in charge of validation and authentication, but business logic should be contained within `service.py` |
| schemas.py         | Pydantic schemas for request/response and data validation. Resources should have schemas for their applicable CRUD operations named `<Resource>(Read                                                    | Create | Update | Delete)` |
| service.py         | Module containing all the business logic. Essentially the non-public API for the resource/service which its own API utilizes along with any other services.                                             |
| signals.py         | Blinker signals (if any). Great way for other services to listen for specific events and do their own thing.                                                                                            |
| receivers.py       | Receiver functions of Blinker signals (if any). Needs to be registered in `polar.receivers` which is mounted ensuring all signals/receivers are setup.                                                  |
| exceptions.py      | Any local exceptions.                                                                                                                                                                                   |
| ***                | resources/services are the same. So extend it as needed.                                                                                                                                                |


Of course, only add what's needed for a given resource/service. Once we've finalized this structure and feel we're used to it, we can create a nice little CLI generator :-)

**Great resources and inspirations**

- https://github.com/zhanymkanov/fastapi-best-practices
- https://github.com/Netflix/dispatch

## Q&A

**Why are database models not in their respective modules vs. `polar.models`?**

Pragmatic solution. Ideally, they would be and `polar.models` could be a global container for them all. The challenge with this is model relationships, e.g `Organization` having many `Repository`, and keeping a feature complete `metadata` object for SQLAlchemy. There are ways around this, but they introduce complexity and some magic that will need to be run at runtime. In short, it creates more problems than it solves.

**Absolute vs. relative imports?**

By default we use absolute imports. However, within an isolated module, e.g `polar.organization`, we use relative imports to their corresponding schemas, endpoints, services and the like for better readability and separation. Let's not be fanatical about it and optimize for readability though, e.g do absolute imports vs. deep relative imports.
