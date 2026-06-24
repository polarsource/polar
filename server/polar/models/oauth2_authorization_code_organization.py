from uuid import UUID

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models.base import Model


class OAuth2AuthorizationCodeOrganization(Model):
    """Down-scopes an `OAuth2AuthorizationCode` to a subset of the user's organizations.

    Carries the down-scope selection made at consent across the code-to-token
    exchange. No rows means *unrestricted* (all the user's organizations,
    resolved live); when rows exist, the resulting token may only act on those
    organizations — always intersected with the user's current membership.
    """

    __tablename__ = "oauth2_authorization_code_organizations"

    oauth2_authorization_code_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("oauth2_authorization_codes.id", ondelete="cascade"),
        primary_key=True,
    )
    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        primary_key=True,
    )
