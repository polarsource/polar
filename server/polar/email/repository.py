from typing import Any
from uuid import UUID

import structlog

from polar.enums import EmailSender
from polar.kit.repository import RepositoryBase
from polar.logging import Logger
from polar.models.email_log import (
    EmailLog,
    EmailLogStatus,
)

log: Logger = structlog.get_logger()


def _extract_organization_id(
    email_props: dict[str, Any],
) -> UUID | None:
    org = email_props.get("organization")
    if org is None:
        return None
    if isinstance(org, dict) and "id" in org:
        return UUID(org["id"])
    log.warning(
        "email_log.organization_id_extraction_failed",
        organization_value=org,
    )
    return None


class EmailLogRepository(RepositoryBase[EmailLog]):
    model = EmailLog

    async def create_log(
        self,
        *,
        status: EmailLogStatus,
        processor: EmailSender,
        to_email_addr: str,
        from_email_addr: str,
        from_name: str,
        subject: str,
        email_template: str | None = None,
        email_props: dict[str, Any] | None = None,
        processor_id: str | None = None,
        error: str | None = None,
    ) -> EmailLog:
        props = email_props or {}
        return await self.create(
            EmailLog(
                status=status,
                processor=processor,
                to_email_addr=to_email_addr,
                from_email_addr=from_email_addr,
                from_name=from_name,
                subject=subject,
                email_template=email_template,
                email_props=props,
                processor_id=processor_id,
                error=error,
                organization_id=_extract_organization_id(props),
            )
        )
