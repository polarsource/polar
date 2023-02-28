import uuid
from typing import Any, AsyncGenerator

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import dialect as postgresql
from tests.fixtures.database import TestModel

from polar.ext.sqlalchemy import GUID, IntEnum
from polar.models.base import StatusFlag
from polar.postgres import AsyncEngineLocal, AsyncSession, sql


@pytest.fixture(scope="module")
async def record(session: AsyncSession) -> AsyncGenerator[TestModel, None]:
    async with AsyncEngineLocal.begin() as conn:
        await conn.run_sync(TestModel.metadata.create_all)

    _uuid = uuid.uuid4()
    hex = _uuid.hex
    input = dict(guid=_uuid, status=StatusFlag.ACTIVE)

    print("zegl", _uuid, hex, input)

    instance = TestModel(
        guid=input["guid"],
        status=input["status"],
    )

    query = sql.select(TestModel).where(TestModel.guid == hex).limit(1)
    raw_sql = text("SELECT guid, status FROM test_model WHERE guid = :hex")

    session.add(instance)
    await session.commit()
    # Forcefully expire to ensure we fetch new one
    session.expire(instance)

    res = await session.execute(query)
    record = res.scalars().one()
    raw = await session.execute(raw_sql, dict(hex=hex))
    raw_guid, raw_status = raw.one()

    record.testing_ctx = {
        "guid": dict(input=input["guid"], persisted=raw_guid),
        "status": dict(input=input["status"], persisted=raw_status),
    }
    yield record


def test_uuid_generator(mocker: MockerFixture) -> None:
    guid = uuid.uuid4()
    uuid4_mock = mocker.patch.object(uuid, "uuid4")
    uuid4_mock.return_value = guid

    generated = GUID.generate()
    assert generated == guid.hex


def test_uuid_processing() -> None:
    instance = GUID()

    def check(value: Any, expected_result: Any) -> None:
        guid = instance.process_result_value(value, postgresql)
        assert expected_result == guid

    # GUID is UUID without the hyphens
    guid = uuid.uuid4()
    check(guid, guid.hex)
    _uuid = uuid.UUID("{12345678-1234-5678-1234-567812345678}")
    check(_uuid, _uuid.hex)

    # Confirm other types are simply returned to us (not supported)
    check(None, None)
    check(1, 1)


@pytest.mark.anyio
async def test_uuid_persistance(record: TestModel) -> None:
    input, persisted = record.testing_ctx["guid"].values()

    # Regular uuid.uuid4() in and same out (with hyphens)
    assert input == persisted
    assert str(persisted).count("-")

    # Hex representation of persisted UUID
    assert persisted.hex == record.guid


def test_intenum_processing() -> None:
    intenum = IntEnum(StatusFlag)
    assert intenum.process_result_value(None, postgresql) is None

    active = intenum.process_result_value(StatusFlag.ACTIVE.value, postgresql)
    assert active is StatusFlag.ACTIVE


@pytest.mark.anyio
async def test_intenum_persistance(record: TestModel) -> None:
    input, persisted = record.testing_ctx["status"].values()

    # Upon fetching from database we bind to our enum
    assert isinstance(record.status, StatusFlag)
    local = StatusFlag(persisted)
    assert local.name == record.status.name

    # However, we store the enum value in the database
    assert record.status.value == persisted


def test_intenum_binding() -> None:
    # Just casting our Enum type and not the type itself, e.g int.
    StatusColumn = IntEnum(StatusFlag)
    assert StatusColumn.process_bind_param("hello", postgresql) == "hello"
    assert (
        StatusColumn.process_bind_param(StatusFlag.ACTIVE, postgresql)
        == StatusFlag.ACTIVE.value
    )
