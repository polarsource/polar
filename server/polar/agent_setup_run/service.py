import secrets
from datetime import timedelta
from typing import Any

from pydantic import ValidationError

from polar.config import settings
from polar.exceptions import PolarRequestValidationError, ResourceNotFound
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.models import AgentSetupRun, Organization
from polar.organization.schemas import OrganizationUpdate
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import AgentSetupRunRepository
from .schemas import AgentSetupDrafts, AgentSetupReport

RUN_TTL = timedelta(hours=24)
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8


class AgentSetupRunService:
    async def create(
        self, session: AsyncSession, organization: Organization
    ) -> tuple[AgentSetupRun, str]:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        repository = AgentSetupRunRepository.from_session(session)
        run = await repository.create(
            AgentSetupRun(
                organization=organization, code_hash=get_token_hash(code), stages={}
            ),
            flush=True,
        )
        return run, code

    async def get_latest(
        self, session: AsyncReadSession, organization: Organization
    ) -> AgentSetupRun:
        repository = AgentSetupRunRepository.from_session(session)
        run = await repository.get_latest_by_organization(organization.id)
        if run is None:
            raise ResourceNotFound()
        return run

    async def approve(
        self,
        session: AsyncSession,
        organization: Organization,
        drafts: AgentSetupDrafts,
    ) -> AgentSetupRun:
        repository = AgentSetupRunRepository.from_session(session)
        run = await repository.get_latest_by_organization(
            organization.id, for_update=True
        )
        if run is None:
            raise ResourceNotFound()
        return await repository.update(
            run,
            update_dict={
                "drafts": drafts.model_dump(mode="json"),
                "approved_at": utc_now(),
            },
        )

    async def report(
        self, session: AsyncSession, report: AgentSetupReport
    ) -> AgentSetupRun:
        repository = AgentSetupRunRepository.from_session(session)
        run = await repository.get_by_code(
            report.code, created_after=utc_now() - RUN_TTL
        )
        if run is None:
            raise ResourceNotFound()

        if report.url is not None and not report.url.startswith(
            f"{settings.FRONTEND_BASE_URL}/"
        ):
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "url"),
                        "msg": "The URL must be a page of the Polar dashboard.",
                        "input": report.url,
                    }
                ]
            )

        update_dict: dict[str, object] = {}
        if report.stage is not None:
            update_dict["stages"] = {
                **run.stages,
                report.stage: {
                    "status": report.status,
                    "note": report.note,
                    "url": report.url,
                },
            }
        if report.drafts is not None:
            await self._fill_organization_profile(
                session, run.organization, report.drafts
            )
            if run.approved_at is None:
                update_dict["drafts"] = {
                    **(run.drafts or {}),
                    **report.drafts.model_dump(mode="json", exclude_unset=True),
                }
        if not update_dict:
            return run
        return await repository.update(run, update_dict=update_dict)

    async def _fill_organization_profile(
        self,
        session: AsyncSession,
        organization: Organization,
        drafts: AgentSetupDrafts,
    ) -> None:
        """Save what the agent found to the fields the organization left empty.

        A value the organization update would reject is skipped, so its
        step stays open for the user.
        """
        found: dict[str, Any] = {}
        if not organization.website and drafts.website:
            found["website"] = drafts.website
        if not organization.email and drafts.support_email:
            found["email"] = drafts.support_email
        if not organization.socials and drafts.socials:
            found["socials"] = [
                social.model_dump(mode="json") for social in drafts.socials
            ]

        accepted: dict[str, Any] = {}
        for field, value in found.items():
            try:
                OrganizationUpdate.model_validate({field: value})
            except ValidationError:
                continue
            accepted[field] = value
        if accepted:
            await organization_service.update(
                session, organization, OrganizationUpdate.model_validate(accepted)
            )


agent_setup_run = AgentSetupRunService()
