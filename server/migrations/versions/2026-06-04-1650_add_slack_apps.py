"""add slack apps

Revision ID: bc2540d6d2c0
Revises: c9e9440f7d03
Create Date: 2026-06-04 16:50:37.766909

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "bc2540d6d2c0"
down_revision = "c9e9440f7d03"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "slack_apps",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("slack_apps_organization_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("slack_apps_pkey")),
        sa.UniqueConstraint(
            "slack_app_id",
            name=op.f("slack_apps_slack_app_id_key"),
        ),
    )
    op.create_index(
        op.f("ix_slack_apps_created_at"),
        "slack_apps",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_slack_apps_deleted_at"),
        "slack_apps",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_slack_apps_organization_id"),
        "slack_apps",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_slack_apps_team_id"),
        "slack_apps",
        ["team_id"],
        unique=False,
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index(
        op.f("ix_slack_apps_team_id"),
        table_name="slack_apps",
    )
    op.drop_index(
        op.f("ix_slack_apps_organization_id"),
        table_name="slack_apps",
    )
    op.drop_index(
        op.f("ix_slack_apps_deleted_at"),
        table_name="slack_apps",
    )
    op.drop_index(
        op.f("ix_slack_apps_created_at"),
        table_name="slack_apps",
    )
    op.drop_table("slack_apps")
