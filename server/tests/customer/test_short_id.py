import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from polar.models.customer import short_id_to_base26


@pytest.mark.asyncio
async def test_generate_customer_short_id_function(session: AsyncSession) -> None:
    """Test that the PostgreSQL generate_customer_short_id() function works correctly."""

    result1 = await session.execute(text("SELECT generate_customer_short_id()"))
    short_id1 = result1.scalar()
    assert short_id1 is not None

    result2 = await session.execute(text("SELECT generate_customer_short_id()"))
    short_id2 = result2.scalar()
    assert short_id2 is not None

    result3 = await session.execute(text("SELECT generate_customer_short_id()"))
    short_id3 = result3.scalar()
    assert short_id3 is not None

    assert short_id1 != short_id2
    assert short_id2 != short_id3
    assert short_id1 != short_id3

    assert short_id1 > 0
    assert short_id2 > 0
    assert short_id3 > 0

    assert short_id2 > short_id1
    assert short_id3 > short_id2


@pytest.mark.asyncio
async def test_customer_short_id_to_base26(session: AsyncSession) -> None:
    """Test that short_id converts to base-26 correctly."""

    # Test some known conversions
    assert short_id_to_base26(0) == "AAAAAAAA"
    assert short_id_to_base26(1) == "AAAAAAAB"
    assert short_id_to_base26(25) == "AAAAAAAZ"
    assert short_id_to_base26(26) == "AAAAAABA"

    # Test with a realistic generated ID
    result = await session.execute(text("SELECT generate_customer_short_id()"))
    short_id = result.scalar()
    assert short_id is not None

    base26 = short_id_to_base26(short_id)

    assert len(base26) == 10
    assert base26.isupper()
    assert all(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" for c in base26)
