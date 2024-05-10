from typing import Any, cast

import structlog

from polar.auth.models import AuthSubject
from polar.logging import Logger
from polar.models import Organization, User
from polar.models.benefit import BenefitFile, BenefitFileProperties

from .base import (
    BenefitServiceProtocol,
)

log: Logger = structlog.get_logger()

precondition_error_subject_template = ()
precondition_error_body_template = """"""


class BenefitFileService(BenefitServiceProtocol[BenefitFile, BenefitFileProperties]):
    async def grant(
        self,
        benefit: BenefitFile,
        user: User,
        grant_properties: dict[str, Any],
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        ...

    async def revoke(
        self,
        benefit: BenefitFile,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        ...

    async def requires_update(
        self,
        benefit: BenefitFile,
        previous_properties: BenefitFileProperties,
    ) -> bool:
        ...

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitFileProperties:
        return cast(BenefitFileProperties, properties)
