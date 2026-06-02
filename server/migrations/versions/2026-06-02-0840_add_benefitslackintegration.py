"""Add BenefitSlackIntegration

Revision ID: 0e4e79f67574
Revises: b7b69a5d5731
Create Date: 2026-05-20 16:11:09.994763

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "0e4e79f67574"
down_revision = "b7b69a5d5731"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "benefit_slack_integrations",
        sa.Column("benefit_id", sa.Uuid(), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("display_name", sa.String(length=35), nullable=False),
        sa.Column("slack_app_id", sa.String(length=32), nullable=True),
        sa.Column("client_id", sa.String(length=255), nullable=True),
        sa.Column("client_secret", sa.String(length=255), nullable=True),
        sa.Column("signing_secret", sa.String(length=255), nullable=True),
        sa.Column("team_id", sa.String(length=32), nullable=True),
        sa.Column("team_name", sa.String(length=255), nullable=True),
        sa.Column("bot_user_id", sa.String(length=32), nullable=True),
        sa.Column("bot_token", sa.String(length=255), nullable=True),
        sa.Column("authed_user_id", sa.String(length=32), nullable=True),
        sa.Column("scopes", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("installed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["benefit_id"],
            ["benefits.id"],
            name=op.f("benefit_slack_integrations_benefit_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("benefit_slack_integrations_organization_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("benefit_slack_integrations_pkey")),
        sa.UniqueConstraint(
            "benefit_id",
            name=op.f("benefit_slack_integrations_benefit_id_key"),
        ),
        sa.UniqueConstraint(
            "slack_app_id",
            name=op.f("benefit_slack_integrations_slack_app_id_key"),
        ),
    )
    op.create_index(
        op.f("ix_benefit_slack_integrations_created_at"),
        "benefit_slack_integrations",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_benefit_slack_integrations_deleted_at"),
        "benefit_slack_integrations",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_benefit_slack_integrations_organization_id"),
        "benefit_slack_integrations",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_benefit_slack_integrations_team_id"),
        "benefit_slack_integrations",
        ["team_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_benefit_slack_integrations_team_id"),
        table_name="benefit_slack_integrations",
    )
    op.drop_index(
        op.f("ix_benefit_slack_integrations_organization_id"),
        table_name="benefit_slack_integrations",
    )
    op.drop_index(
        op.f("ix_benefit_slack_integrations_deleted_at"),
        table_name="benefit_slack_integrations",
    )
    op.drop_index(
        op.f("ix_benefit_slack_integrations_created_at"),
        table_name="benefit_slack_integrations",
    )
    op.drop_table("benefit_slack_integrations")
