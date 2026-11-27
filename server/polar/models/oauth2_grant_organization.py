from uuid import UUID

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models.base import Model


class OAuth2GrantOrganization(Model):
    __tablename__ = "oauth2_grant_organizations"

    oauth2_grant_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("oauth2_grants.id", ondelete="cascade"),
        primary_key=True,
    )
    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        primary_key=True,
    )
