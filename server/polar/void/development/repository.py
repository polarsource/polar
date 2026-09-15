from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select, text

from polar.kit.repository import RepositoryBase
from polar.models import Account, Organization


class DevelopmentRepository(RepositoryBase[Organization]):
    model = Organization

    async def lock_seed(self) -> None:
        await self.session.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
            {"key": "polar-void-development-seed"},
        )

    async def organizations(self, id: UUID, slug: str) -> Sequence[Organization]:
        return await self.get_all(
            select(Organization)
            .where((Organization.id == id) | (Organization.slug == slug))
            .with_for_update(key_share=True)
            .execution_options(populate_existing=True)
        )

    async def account(self, id: UUID) -> Account | None:
        return await self.session.scalar(
            select(Account).where(Account.id == id).with_for_update(key_share=True)
        )
