from __future__ import annotations

from uuid import UUID
from typing import Any, Generic, Sequence, TypeVar

from sqlalchemy.orm import InstrumentedAttribute

from polar.kit.utils import utc_now

from .db.models import RecordModel
from .db.postgres import AsyncSession, sql
from .schemas import Schema

ModelType = TypeVar("ModelType", bound=RecordModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=Schema)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=Schema)


class ResourceServiceReader(
    Generic[ModelType],
):
    def __init__(self, model: type[ModelType]) -> None:
        self.model = model

    async def get(
        self, session: AsyncSession, id: UUID, allow_deleted: bool = False
    ) -> ModelType | None:
        query = sql.select(self.model).where(self.model.id == id)
        if not allow_deleted:
            query = query.where(self.model.deleted_at.is_(None))
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def get_by(self, session: AsyncSession, **clauses: Any) -> ModelType | None:
        query = sql.select(self.model).filter_by(**clauses)
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def soft_delete(self, session: AsyncSession, id: UUID) -> None:
        stmt = (
            sql.update(self.model)
            .where(self.model.id == id, self.model.deleted_at.is_(None))
            .values(
                deleted_at=utc_now(),
            )
        )
        await session.execute(stmt)
        await session.commit()


class ResourceService(
    ResourceServiceReader[ModelType],
    Generic[ModelType, CreateSchemaType, UpdateSchemaType],
):
    # Ideally, actions would only contain class methods since there is
    # no state to retain. Unable to achieve this with mapping the model
    # and schema as class attributes though without breaking typing.

    @property
    def upsert_constraints(self) -> list[InstrumentedAttribute[Any]]:
        return [self.model.id]

    async def create(
        self,
        session: AsyncSession,
        create_schema: CreateSchemaType,
        autocommit: bool = True,
    ) -> ModelType:
        return await self.model.create(
            session, **create_schema.dict(), autocommit=autocommit
        )

    # TODO: Investigate new bulk methods in SQLALchemy 2.0 for upsert_many
    async def upsert_many(
        self,
        session: AsyncSession,
        create_schemas: list[CreateSchemaType],
        constraints: list[InstrumentedAttribute[Any]] | None = None,
        mutable_keys: set[str] | None = None,
        autocommit: bool = True,
    ) -> Sequence[ModelType]:
        if constraints is None:
            constraints = self.upsert_constraints

        return await self.model.upsert_many(
            session,
            create_schemas,
            constraints=constraints,
            mutable_keys=mutable_keys,
            autocommit=autocommit,
        )

    async def upsert(
        self,
        session: AsyncSession,
        create_schema: CreateSchemaType,
        constraints: list[InstrumentedAttribute[Any]] | None = None,
        mutable_keys: set[str] | None = None,
        autocommit: bool = True,
    ) -> ModelType:
        if constraints is None:
            constraints = self.upsert_constraints

        return await self.model.upsert(
            session,
            create_schema,
            constraints=constraints,
            mutable_keys=mutable_keys,
            autocommit=autocommit,
        )

    async def update(
        self,
        session: AsyncSession,
        source: ModelType,
        update_schema: UpdateSchemaType,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        autocommit: bool = True,
    ) -> ModelType:
        return await source.update(
            session,
            include=include,
            exclude=exclude,
            autocommit=autocommit,
            **update_schema.dict(),
        )
