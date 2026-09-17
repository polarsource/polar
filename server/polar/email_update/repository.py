from sqlalchemy.orm import joinedload

from polar.kit.crypto import get_token_hash
from polar.kit.repository import RepositoryBase
from polar.kit.utils import utc_now
from polar.models import EmailVerification


class EmailVerificationRepository(RepositoryBase[EmailVerification]):
    model = EmailVerification

    async def get_by_token(self, token: str) -> EmailVerification | None:
        statement = (
            self.get_base_statement()
            .where(
                EmailVerification.token_hash == get_token_hash(token),
                EmailVerification.expires_at > utc_now(),
            )
            .options(joinedload(EmailVerification.user))
        )
        return await self.get_one_or_none(statement)
