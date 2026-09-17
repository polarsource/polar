from uuid import UUID

from sqlalchemy import Select

from polar.kit.repository import RepositoryBase
from polar.models import VoidJudgment


class JudgmentRepository(RepositoryBase[VoidJudgment]):
    model = VoidJudgment

    def scoped_statement(self, organization_id: UUID) -> Select[tuple[VoidJudgment]]:
        return self.get_base_statement().where(
            VoidJudgment.organization_id == organization_id,
            VoidJudgment.deleted_at.is_(None),
        )

    async def get(
        self,
        organization_id: UUID,
        version_id: str,
        identity_id: str,
        meter_slug: str,
        question_hash: str,
    ) -> VoidJudgment | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(
                VoidJudgment.version_id == version_id,
                VoidJudgment.external_identity_id == identity_id,
                VoidJudgment.meter_slug == meter_slug,
                VoidJudgment.question_hash == question_hash,
            )
        )
