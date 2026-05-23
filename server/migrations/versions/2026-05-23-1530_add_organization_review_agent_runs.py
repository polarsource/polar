"""add organization_review_agent_runs

Slice 0 of the v2 organization review agent. One run row per triggered
review; columns added later (``owner_user_id``, ``due_at``) attach to
this same table.

Revision ID: a1f3c2d4e5b6
Revises: 7fd960e94b08
Create Date: 2026-05-23 15:30:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1f3c2d4e5b6"
down_revision = "7fd960e94b08"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organization_review_agent_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "modified_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column(
            "deleted_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("context", sa.String(length=32), nullable=False),
        sa.Column(
            "triggered_by",
            sa.String(length=64),
            nullable=False,
            server_default="system",
        ),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("current_node", sa.String(length=64), nullable=True),
        sa.Column(
            "state_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "events",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "llm_calls",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "usage",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "org_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "final_report",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("plain_thread_id", sa.String(length=64), nullable=True),
        sa.Column(
            "heartbeat_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column(
            "started_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column(
            "completed_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column("parent_agent_run_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f(
                "organization_review_agent_runs_organization_id_fkey"
            ),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["parent_agent_run_id"],
            ["organization_review_agent_runs.id"],
            name=op.f(
                "organization_review_agent_runs_parent_agent_run_id_fkey"
            ),
            ondelete="set null",
        ),
        sa.PrimaryKeyConstraint(
            "id", name=op.f("organization_review_agent_runs_pkey")
        ),
    )
    op.create_index(
        op.f("ix_organization_review_agent_runs_created_at"),
        "organization_review_agent_runs",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_review_agent_runs_deleted_at"),
        "organization_review_agent_runs",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_review_agent_runs_organization_id"),
        "organization_review_agent_runs",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_review_agent_runs_context"),
        "organization_review_agent_runs",
        ["context"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_review_agent_runs_status"),
        "organization_review_agent_runs",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_review_agent_runs_plain_thread_id"),
        "organization_review_agent_runs",
        ["plain_thread_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_review_agent_runs_heartbeat_at"),
        "organization_review_agent_runs",
        ["heartbeat_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_review_agent_runs_parent_agent_run_id"),
        "organization_review_agent_runs",
        ["parent_agent_run_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_organization_review_agent_runs_parent_agent_run_id"),
        table_name="organization_review_agent_runs",
    )
    op.drop_index(
        op.f("ix_organization_review_agent_runs_heartbeat_at"),
        table_name="organization_review_agent_runs",
    )
    op.drop_index(
        op.f("ix_organization_review_agent_runs_plain_thread_id"),
        table_name="organization_review_agent_runs",
    )
    op.drop_index(
        op.f("ix_organization_review_agent_runs_status"),
        table_name="organization_review_agent_runs",
    )
    op.drop_index(
        op.f("ix_organization_review_agent_runs_context"),
        table_name="organization_review_agent_runs",
    )
    op.drop_index(
        op.f("ix_organization_review_agent_runs_organization_id"),
        table_name="organization_review_agent_runs",
    )
    op.drop_index(
        op.f("ix_organization_review_agent_runs_deleted_at"),
        table_name="organization_review_agent_runs",
    )
    op.drop_index(
        op.f("ix_organization_review_agent_runs_created_at"),
        table_name="organization_review_agent_runs",
    )
    op.drop_table("organization_review_agent_runs")
