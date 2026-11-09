import pytest
from sqlalchemy.exc import IntegrityError

from polar.models import BackofficeUser
from polar.postgres import AsyncSession


@pytest.mark.anyio
async def test_email_is_unique_after_normalization(session: AsyncSession) -> None:
    session.add(BackofficeUser(email="Staff@example.com"))
    await session.flush()

    with pytest.raises(IntegrityError, match="ix_backoffice_users_normalized_email"):
        async with session.begin_nested():
            session.add(BackofficeUser(email="staff@example.com"))
            await session.flush()
