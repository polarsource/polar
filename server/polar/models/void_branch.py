import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

from .void_deployment import VoidDeployment

if TYPE_CHECKING:
    from .organization import Organization


class VoidBranch(RecordModel):
    """A mutable fork of one configuration version, edited in the dashboard.

    A branch never serves traffic: it has no meter or product rows of its own.
    Its patch is applied to the base deployment's configuration on read, and
    promoting it deploys that resolved configuration as an ordinary draft.
    """

    __tablename__ = "void_branches"

    name: Mapped[str] = mapped_column(String, nullable=False)
    base_version_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    base_deployment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("void_deployments.id"), nullable=False, index=True
    )
    patch: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    promoted_deployment_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("void_deployments.id"), nullable=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")
    base_deployment: Mapped[VoidDeployment] = relationship(
        lazy="raise", foreign_keys=[base_deployment_id]
    )
