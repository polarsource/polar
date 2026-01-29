from collections.abc import Sequence
from uuid import UUID

import structlog

from polar.exceptions import PolarError, ResourceNotFound
from polar.kit.pagination import PaginationParams, paginate
from polar.models import Perk, PerkClaim, PerkCategory
from polar.postgres import AsyncSession

from .repository import PerkClaimRepository, PerkRepository

log = structlog.get_logger()


class PerkError(PolarError):
    ...


class PerkNotFound(ResourceNotFound):
    def __init__(self, perk_id: UUID):
        super().__init__(f"Perk {perk_id} not found.")
        self.perk_id = perk_id


class PerkService:
    async def list(
        self,
        session: AsyncSession,
        *,
        category: PerkCategory | None = None,
        featured_only: bool = False,
        pagination: PaginationParams,
    ) -> tuple[Sequence[Perk], int]:
        """List all active perks."""
        repository = PerkRepository(session)
        statement = repository.get_active_statement()

        if category is not None:
            statement = statement.where(Perk.category == category)

        if featured_only:
            statement = statement.where(Perk.featured.is_(True))

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        perk_id: UUID,
    ) -> Perk | None:
        """Get a perk by ID."""
        repository = PerkRepository(session)
        statement = repository.get_active_statement().where(Perk.id == perk_id)
        return await repository.get_one_or_none(statement)

    async def claim(
        self,
        session: AsyncSession,
        *,
        perk_id: UUID,
        user_id: UUID,
    ) -> tuple[PerkClaim, Perk, int]:
        """
        Claim a perk for a user.
        Returns the claim, the perk (with redemption details), and total claim count.
        """
        # Get the perk
        perk = await self.get_by_id(session, perk_id)
        if perk is None:
            raise PerkNotFound(perk_id)

        claim_repository = PerkClaimRepository(session)

        # Check if user already claimed (we allow re-claims but track them)
        existing_claim = await claim_repository.get_user_claim(perk_id, user_id)

        if existing_claim is None:
            # Create new claim record
            claim = PerkClaim(perk_id=perk_id, user_id=user_id)
            await claim_repository.create(claim, flush=True)
            log.info(
                "perk.claimed",
                perk_id=str(perk_id),
                user_id=str(user_id),
                provider=perk.provider_name,
            )
        else:
            # Return existing claim
            claim = existing_claim

        total_claims = await claim_repository.get_claim_count(perk_id)

        return claim, perk, total_claims

    async def get_claim_count(
        self,
        session: AsyncSession,
        perk_id: UUID,
    ) -> int:
        """Get total claim count for a perk."""
        claim_repository = PerkClaimRepository(session)
        return await claim_repository.get_claim_count(perk_id)


perk = PerkService()
