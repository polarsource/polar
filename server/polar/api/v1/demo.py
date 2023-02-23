import structlog
from fastapi import APIRouter, Depends, HTTPException
from polar.actions import demo
from polar.api.deps import get_db_session
from polar.postgres import AsyncSession
from polar.schema.demo import CreateDemo, DemoSchema, UpdateDemo

router = APIRouter(prefix="/demo", tags=["Demo"])

log = structlog.get_logger()


@router.get("/", response_model=list[DemoSchema])
async def get_all(session: AsyncSession = Depends(get_db_session)) -> list[DemoSchema]:
    demos = await demo.get_all(session)
    return demos


@router.get("/{demo_id}", response_model=DemoSchema)
async def get(
    demo_id: str, session: AsyncSession = Depends(get_db_session)
) -> DemoSchema:
    instance = await demo.get(session, demo_id)
    return DemoSchema.from_orm(instance)


@router.post("/", response_model=DemoSchema)
async def create(
    demo_in: CreateDemo, session: AsyncSession = Depends(get_db_session)
) -> DemoSchema:
    instance = await demo.create(session, demo_in)
    return DemoSchema.from_orm(instance)


@router.put("/{demo_id}", response_model=DemoSchema)
async def update(
    demo_id: str, demo_in: UpdateDemo, session: AsyncSession = Depends(get_db_session)
) -> DemoSchema:
    record = await demo.get(session, demo_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    updated = await demo.update(session, record, demo_in)
    return DemoSchema.from_orm(updated)


@router.delete("/{demo_id}", status_code=204)
async def delete(demo_id: str, session: AsyncSession = Depends(get_db_session)) -> None:
    deleted = await demo.delete(session, id=demo_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Record not found")
