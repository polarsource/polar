from uuid import UUID

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models.base import Model


class OAuth2TokenOrganization(Model):
    """Down-scopes an `OAuth2Token` to a subset of the user's organizations.

    No rows for a token means *unrestricted* (all the user's organizations,
    resolved live). When rows exist, the token may only act on those
    organizations — always intersected with the user's current membership.
    """

    __tablename__ = "oauth2_token_organizations"

    oauth2_token_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("oauth2_tokens.id", ondelete="cascade"),
        primary_key=True,
    )
    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        primary_key=True,
    )
