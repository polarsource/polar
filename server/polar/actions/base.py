from __future__ import annotations

from typing import Any, Generic, TypeVar

from sqlalchemy import Column

from polar.ext.sqlalchemy.types import GUID
from polar.models.base import RecordModel
from polar.postgres import AsyncSession, sql
from polar.schema.base import Schema

ModelType = TypeVar("ModelType", bound=RecordModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=Schema)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=Schema)


class Action(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    # Ideally, actions would only contain class methods since there is
    # no state to retain. Unable to achieve this with mapping the model
    # and schema as class attributes though without breaking typing.

    def __init__(self, model: type[ModelType]) -> None:
        self.model = model

    @property
    def default_upsert_index_elements(self) -> list[Column[Any]]:
        return [self.model.id]

    async def get(self, session: AsyncSession, id: GUID) -> ModelType | None:
        query = sql.select(self.model).where(self.model.id == id)
        return await self.get_by_query(session, query)

    async def get_by(self, session: AsyncSession, **clauses: Any) -> ModelType | None:
        query = sql.select(self.model).filter_by(**clauses)
        return await self.get_by_query(session, query)

    async def get_by_query(
        self, session: AsyncSession, query: sql.Select
    ) -> ModelType | None:
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

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
        index_elements: list[Column[Any]] | None = None,
        mutable_keys: set[str] | None = None,
    ) -> list[ModelType]:
        if index_elements is None:
            index_elements = self.default_upsert_index_elements

        return await self.model.upsert_many(
            session,
            create_schemas,
            index_elements=index_elements,
            mutable_keys=mutable_keys,
        )

    async def upsert(
        self,
        session: AsyncSession,
        create_schema: CreateSchemaType,
        index_elements: list[Column[Any]] | None = None,
        mutable_keys: set[str] | None = None,
    ) -> ModelType:
        if index_elements is None:
            index_elements = self.default_upsert_index_elements

        return await self.model.upsert(
            session,
            create_schema,
            index_elements=index_elements,
            mutable_keys=mutable_keys,
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

    async def delete(self, session: AsyncSession, **clauses: Any) -> bool:
        # TODO: Return object for external invokation to leverage + verify?
        obj = await self.get_by(session, **clauses)
        if not obj:
            return False

        await obj.delete(session)
        return True
