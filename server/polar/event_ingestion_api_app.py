from fastapi import APIRouter

from polar.app import create_app
from polar.event.endpoints import ingest_router
from polar.logfire import instrument_fastapi

api_router = APIRouter(prefix="/v1")
api_router.include_router(ingest_router)

# psycopg runs each query in one round trip behind PgBouncer; asyncpg needs three
app = create_app(api_router, database_driver="psycopg")
instrument_fastapi(app)
