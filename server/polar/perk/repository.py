from uuid import UUID

from sqlalchemy import Select, func, select

from polar.kit.repository import (
    RepositoryBase,
    RepositoryIDMixin,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Perk, PerkClaim


class PerkRepository(
    RepositorySoftDeletionMixin[Perk],
    RepositorySoftDeletionIDMixin[Perk, UUID],
    RepositoryBase[Perk],
):
    model = Perk

    def get_active_statement(self) -> Select[tuple[Perk]]:
        """Get base statement filtered to only active perks."""
        return (
            self.get_base_statement()
            .where(Perk.is_active.is_(True))
            .where(Perk.deleted_at.is_(None))
            .order_by(Perk.display_order.asc(), Perk.created_at.desc())
        )


class PerkClaimRepository(
    RepositorySoftDeletionMixin[PerkClaim],
    RepositoryIDMixin[PerkClaim, UUID],
    RepositoryBase[PerkClaim],
):
    model = PerkClaim

    async def get_claim_count(self, perk_id: UUID) -> int:
        """Get total claim count for a perk."""
        statement = select(func.count()).where(
            PerkClaim.perk_id == perk_id,
            PerkClaim.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar() or 0

    async def has_user_claimed(self, perk_id: UUID, user_id: UUID) -> bool:
        """Check if a user has already claimed a perk."""
        statement = select(PerkClaim).where(
            PerkClaim.perk_id == perk_id,
            PerkClaim.user_id == user_id,
            PerkClaim.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none() is not None

    async def get_user_claim(self, perk_id: UUID, user_id: UUID) -> PerkClaim | None:
        """Get a user's claim for a perk."""
        statement = (
            self.get_base_statement()
            .where(
                PerkClaim.perk_id == perk_id,
                PerkClaim.user_id == user_id,
                PerkClaim.deleted_at.is_(None),
            )
        )
        return await self.get_one_or_none(statement)
