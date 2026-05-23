"""add organization_review_signal_history

Cross-run memory for individual signal resolutions. One row per
emitted signal, plus the reviewer's adjudication when they click
agree/discard on the agent-run page.

Revision ID: b2e4f5d6c789
Revises: a1f3c2d4e5b6
Create Date: 2026-05-23 17:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b2e4f5d6c789"
down_revision = "a1f3c2d4e5b6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organization_review_signal_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), nullable=False
        ),
        sa.Column(
            "modified_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column(
            "deleted_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("agent_run_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column(
            "evidence",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "resolution",
            sa.String(length=16),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("reviewer_reason", sa.Text(), nullable=True),
        sa.Column("reviewed_by_user_id", sa.Uuid(), nullable=True),
        sa.Column(
            "reviewed_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column(
            "retired_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f(
                "organization_review_signal_history_organization_id_fkey"
            ),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["agent_run_id"],
            ["organization_review_agent_runs.id"],
            name=op.f(
                "organization_review_signal_history_agent_run_id_fkey"
            ),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_user_id"],
            ["users.id"],
            name=op.f(
                "organization_review_signal_history_reviewed_by_user_id_fkey"
            ),
            ondelete="set null",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name=op.f("organization_review_signal_history_pkey"),
        ),
    )
    op.create_index(
        op.f("ix_organization_review_signal_history_created_at"),
        "organization_review_signal_history",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_review_signal_history_deleted_at"),
        "organization_review_signal_history",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_review_signal_history_organization_id"),
        "organization_review_signal_history",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_review_signal_history_agent_run_id"),
        "organization_review_signal_history",
        ["agent_run_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_review_signal_history_kind"),
        "organization_review_signal_history",
        ["kind"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_review_signal_history_resolution"),
        "organization_review_signal_history",
        ["resolution"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_review_signal_history_retired_at"),
        "organization_review_signal_history",
        ["retired_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_organization_review_signal_history_retired_at"),
        table_name="organization_review_signal_history",
    )
    op.drop_index(
        op.f("ix_organization_review_signal_history_resolution"),
        table_name="organization_review_signal_history",
    )
    op.drop_index(
        op.f("ix_organization_review_signal_history_kind"),
        table_name="organization_review_signal_history",
    )
    op.drop_index(
        op.f("ix_organization_review_signal_history_agent_run_id"),
        table_name="organization_review_signal_history",
    )
    op.drop_index(
        op.f("ix_organization_review_signal_history_organization_id"),
        table_name="organization_review_signal_history",
    )
    op.drop_index(
        op.f("ix_organization_review_signal_history_deleted_at"),
        table_name="organization_review_signal_history",
    )
    op.drop_index(
        op.f("ix_organization_review_signal_history_created_at"),
        table_name="organization_review_signal_history",
    )
    op.drop_table("organization_review_signal_history")
