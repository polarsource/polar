from dataclasses import dataclass

from polar.kit.hook import Hook
from polar.models.organization import Organization
from polar.postgres import AsyncSession


@dataclass
class OrganizationHook:
    session: AsyncSession
    organization: Organization


organization_upserted: Hook[OrganizationHook] = Hook()
