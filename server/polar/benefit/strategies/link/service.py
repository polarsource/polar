from collections.abc import Iterable
from typing import Any, Unpack, cast
from urllib.parse import quote

from polar.auth.models import AuthSubject
from polar.models import Benefit, Customer, Member, Organization, User
from polar.models.benefit_grant import BenefitGrantScopeArgs

from ..base.schemas import BenefitBase
from ..base.service import BenefitServiceProtocol
from .properties import BenefitGrantLinkProperties, BenefitLinkProperties
from .schemas import (
    CUSTOMER_EMAIL_PLACEHOLDER,
    CUSTOMER_EXTERNAL_ID_PLACEHOLDER,
    BenefitLink,
)


def resolve_link_url(url: str, *, email: str, external_id: str | None) -> str:
    return url.replace(CUSTOMER_EMAIL_PLACEHOLDER, quote(email, safe="")).replace(
        CUSTOMER_EXTERNAL_ID_PLACEHOLDER, quote(external_id or "", safe="")
    )


def resolve_email_link_urls(
    benefits: Iterable[BenefitBase], *, email: str, external_id: str | None
) -> None:
    """
    Resolves the URL of every link benefit in place, for a single email recipient.

    Grants may not exist yet when order and subscription emails are sent, so the
    customer placeholders are resolved from the recipient instead of read from the
    grant properties. The benefits must be built per recipient: substitution is
    destructive, so reusing them would leak the first recipient's values.
    """
    for benefit in benefits:
        if isinstance(benefit, BenefitLink):
            benefit.properties.url = resolve_link_url(
                benefit.properties.url, email=email, external_id=external_id
            )


class BenefitLinkService(
    BenefitServiceProtocol[BenefitLinkProperties, BenefitGrantLinkProperties]
):
    async def grant(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantLinkProperties,
        *,
        update: bool = False,
        attempt: int = 1,
        member: Member | None = None,
        **scope: Unpack[BenefitGrantScopeArgs],
    ) -> BenefitGrantLinkProperties:
        properties = self._get_properties(benefit)
        return {
            "url": resolve_link_url(
                properties["url"],
                email=member.email if member is not None else customer.email or "",
                external_id=customer.external_id,
            )
        }

    async def cycle(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantLinkProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantLinkProperties:
        return grant_properties

    async def revoke(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantLinkProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantLinkProperties:
        return {}

    async def requires_update(
        self, benefit: Benefit, previous_properties: BenefitLinkProperties
    ) -> bool:
        new_properties = self._get_properties(benefit)
        return new_properties["url"] != previous_properties["url"]

    async def validate_properties(
        self,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        properties: dict[str, Any],
    ) -> BenefitLinkProperties:
        return cast(BenefitLinkProperties, properties)
