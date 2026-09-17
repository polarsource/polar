from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select

from polar.kit.repository import RepositoryBase
from polar.models import VoidSense, VoidSenseObservation


class SenseRepository(RepositoryBase[VoidSense]):
    model = VoidSense

    def scoped_statement(self, organization_id: UUID) -> Select[tuple[VoidSense]]:
        return self.get_base_statement().where(
            VoidSense.organization_id == organization_id,
            VoidSense.deleted_at.is_(None),
        )

    async def list(self, organization_id: UUID) -> Sequence[VoidSense]:
        return await self.get_all(
            self.scoped_statement(organization_id).order_by(
                VoidSense.slug, VoidSense.id
            )
        )

    async def list_for_version(
        self, organization_id: UUID, version_id: str
    ) -> Sequence[VoidSense]:
        return await self.get_all(
            self.scoped_statement(organization_id)
            .where(VoidSense.version_id == version_id)
            .order_by(VoidSense.slug, VoidSense.id)
        )

    async def list_for_activity(
        self, organization_id: UUID, version_id: str, activity_id: UUID
    ) -> Sequence[VoidSense]:
        return await self.get_all(
            self.scoped_statement(organization_id).where(
                VoidSense.version_id == version_id,
                VoidSense.activity_id == activity_id,
            )
        )

    async def get(self, organization_id: UUID, id: UUID) -> VoidSense | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(VoidSense.id == id)
        )


class SenseObservationRepository(RepositoryBase[VoidSenseObservation]):
    model = VoidSenseObservation

    def scoped_statement(
        self, organization_id: UUID
    ) -> Select[tuple[VoidSenseObservation]]:
        return self.get_base_statement().where(
            VoidSenseObservation.organization_id == organization_id,
            VoidSenseObservation.deleted_at.is_(None),
        )

    async def get_observation(
        self,
        organization_id: UUID,
        version_id: str,
        sense_id: UUID,
        identity: str,
        run_key: str,
    ) -> VoidSenseObservation | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(
                VoidSenseObservation.version_id == version_id,
                VoidSenseObservation.sense_id == sense_id,
                VoidSenseObservation.external_identity_id == identity,
                VoidSenseObservation.run_key == run_key,
            )
        )

    async def list_for_root(
        self, organization_id: UUID, version_id: str, identities: Sequence[str]
    ) -> Sequence[VoidSenseObservation]:
        if not identities:
            return []
        return await self.get_all(
            self.scoped_statement(organization_id)
            .where(
                VoidSenseObservation.version_id == version_id,
                VoidSenseObservation.external_identity_id.in_(list(identities)),
            )
            .order_by(
                VoidSenseObservation.evaluated_at.desc(),
                VoidSenseObservation.id.desc(),
            )
        )
