from sqlalchemy.orm import joinedload

from polar.kit.crypto import get_token_hash_candidates
from polar.kit.repository import RepositoryBase, RepositoryTokenHashMixin
from polar.kit.utils import utc_now
from polar.models import EmailVerification


class EmailVerificationRepository(
    RepositoryTokenHashMixin[EmailVerification],
    RepositoryBase[EmailVerification],
):
    model = EmailVerification
    token_hash_attribute = "token_hash"

    async def get_by_token(self, token: str) -> EmailVerification | None:
        statement = (
            self.get_base_statement()
            .where(
                self.token_hash_clause(get_token_hash_candidates(token)),
                EmailVerification.expires_at > utc_now(),
            )
            .options(joinedload(EmailVerification.user))
        )
        return await self.get_one_or_none(statement)
