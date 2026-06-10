from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel

if TYPE_CHECKING:
    from .organization import Organization


class LLMProviderConfig(RecordModel):
    __tablename__ = "llm_provider_configs"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "provider",
            "model_name",
            "deleted_at",
            name="llm_provider_configs_org_provider_model_key",
        ),
    )

    provider: Mapped[str] = mapped_column(
        String(64), nullable=False, doc="LLM provider identifier, e.g. openai, anthropic"
    )
    model_name: Mapped[str] = mapped_column(
        String(256), nullable=False, doc="Model identifier, e.g. gpt-4o"
    )
    display_name: Mapped[str | None] = mapped_column(
        String(256), nullable=True, default=None, doc="Optional display name for customers"
    )
    api_key_encrypted: Mapped[str] = mapped_column(
        Text, nullable=False, doc="Fernet-encrypted provider API key"
    )
    is_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, doc="Whether this config is active"
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise_on_sql")
