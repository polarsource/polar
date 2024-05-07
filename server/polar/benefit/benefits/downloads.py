from typing import Any

import structlog

from polar.auth.models import AuthSubject
from polar.logging import Logger
from polar.models import Organization, User
from polar.models.benefit import BenefitDownloads, BenefitDownloadsProperties

from .base import (
    BenefitServiceProtocol,
)

log: Logger = structlog.get_logger()

precondition_error_subject_template = ()
precondition_error_body_template = """"""


class BenefitDownloadsService(
    BenefitServiceProtocol[BenefitDownloads, BenefitDownloadsProperties]
):
    async def grant(
        self,
        benefit: BenefitDownloads,
        user: User,
        grant_properties: dict[str, Any],
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        ...

    async def revoke(
        self,
        benefit: BenefitDownloads,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        ...

    async def requires_update(
        self,
        benefit: BenefitDownloads,
        previous_properties: BenefitDownloadsProperties,
    ) -> bool:
        ...

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitDownloadsProperties:
        ...
