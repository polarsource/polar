import uuid

import pytest
from sqlalchemy.dialects.postgresql import dialect as postgresql

from polar.kit.db.models import StatusFlag
from polar.kit.extensions.sqlalchemy import IntEnum
from polar.postgres import AsyncEngineLocal, AsyncSession, sql
from tests.fixtures.database import TestModel


def test_intenum_processing() -> None:
    intenum = IntEnum(StatusFlag)
    assert intenum.process_result_value(None, postgresql) is None  # type: ignore

    active = intenum.process_result_value(StatusFlag.ACTIVE.value, postgresql)  # type: ignore
    assert active is StatusFlag.ACTIVE


@pytest.mark.asyncio
async def test_intenum_persistance(session: AsyncSession) -> None:
    async with AsyncEngineLocal.begin() as conn:
        await conn.run_sync(TestModel.metadata.create_all)

    assert StatusFlag.ACTIVE.value == 1

    _uuid = uuid.uuid4()
    record = TestModel(status=1, uuid=_uuid)
    session.add(record)
    await session.commit()

    # Ensure we fetch a new one
    session.expire(record)

    query = sql.select(TestModel).where(TestModel.uuid == _uuid).limit(1)

    res = await session.execute(query)
    record = res.scalars().one()

    assert isinstance(record.status, StatusFlag)
    assert record.status == StatusFlag.ACTIVE
    assert isinstance(record.uuid, uuid.UUID)


def test_intenum_binding() -> None:
    # Just casting our Enum type and not the type itself, e.g int.
    StatusColumn = IntEnum(StatusFlag)
    assert StatusColumn.process_bind_param("hello", postgresql) == "hello"  # type: ignore
    assert (
        StatusColumn.process_bind_param(StatusFlag.ACTIVE, postgresql)  # type: ignore
        == StatusFlag.ACTIVE.value
    )
