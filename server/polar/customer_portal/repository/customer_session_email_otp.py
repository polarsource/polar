from uuid import UUID

from sqlalchemy import delete

from polar.kit.repository import RepositoryBase
from polar.kit.repository.base import RepositoryIDMixin
from polar.kit.utils import utc_now
from polar.models import CustomerSessionEmailOTP


class CustomerSessionEmailOTPRepository(
    RepositoryBase[CustomerSessionEmailOTP],
    RepositoryIDMixin[CustomerSessionEmailOTP, UUID],
):
    model = CustomerSessionEmailOTP

    async def delete_expired(self) -> None:
        statement = delete(CustomerSessionEmailOTP).where(
            CustomerSessionEmailOTP.expires_at < int(utc_now().timestamp())
        )
        await self.session.execute(statement)
