"""add agent_setup_runs

Revision ID: 60fae57f6e1d
Revises: 3c1e7a9d52f4
Create Date: 2026-11-23 16:04:38.565820

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "60fae57f6e1d"
down_revision = "3c1e7a9d52f4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "agent_setup_runs",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("code_hash", sa.String(length=80), nullable=False),
        sa.Column("stages", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("drafts", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("approved_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("agent_setup_runs_organization_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("agent_setup_runs_pkey")),
        sa.UniqueConstraint("code_hash", name=op.f("agent_setup_runs_code_hash_key")),
    )
    op.create_index(
        op.f("ix_agent_setup_runs_created_at"),
        "agent_setup_runs",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agent_setup_runs_deleted_at"),
        "agent_setup_runs",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agent_setup_runs_organization_id"),
        "agent_setup_runs",
        ["organization_id"],
        unique=False,
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index(
        op.f("ix_agent_setup_runs_organization_id"), table_name="agent_setup_runs"
    )
    op.drop_index(op.f("ix_agent_setup_runs_deleted_at"), table_name="agent_setup_runs")
    op.drop_index(op.f("ix_agent_setup_runs_created_at"), table_name="agent_setup_runs")
    op.drop_table("agent_setup_runs")
