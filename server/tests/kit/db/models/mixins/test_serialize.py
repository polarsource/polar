import pytest

from polar.kit.db.models.mixins import SerializeMixin
from polar.postgres import AsyncSession
from tests.fixtures.database import TestModel


class SerializeModel(TestModel, SerializeMixin):
    ...


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_to_dict(session: AsyncSession) -> None:
    created = SerializeModel(int_column=1, str_column="Dict")
    session.add(created)
    await session.commit()

    assert created.id is not None
    as_dict = created.to_dict()
    assert isinstance(as_dict, dict)
    columns = created.__table__.c
    for column in columns:
        assert as_dict.pop(column.name) == getattr(created, column.name)

    assert len(as_dict) == 0
