"""Add email_logs table

Revision ID: d9f75192e3e7
Revises: d7d40e0b8721
Create Date: 2026-03-05 12:34:55.749039

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d9f75192e3e7"
down_revision = "d7d40e0b8721"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "email_logs",
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("processor", sa.String(), nullable=False),
        sa.Column("processor_id", sa.String(), nullable=True),
        sa.Column("to_email_addr", sa.String(), nullable=False),
        sa.Column("from_email_addr", sa.String(), nullable=False),
        sa.Column("from_name", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("email_template", sa.String(), nullable=True),
        sa.Column(
            "email_props",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("error", sa.String(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("email_logs_pkey")),
    )
    op.create_index(
        op.f("ix_email_logs_created_at"),
        "email_logs",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_email_logs_deleted_at"),
        "email_logs",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_email_logs_organization_id"),
        "email_logs",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_email_logs_status"),
        "email_logs",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_email_logs_to_email_addr"),
        "email_logs",
        ["to_email_addr"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_email_logs_to_email_addr"), table_name="email_logs")
    op.drop_index(op.f("ix_email_logs_status"), table_name="email_logs")
    op.drop_index(op.f("ix_email_logs_organization_id"), table_name="email_logs")
    op.drop_index(op.f("ix_email_logs_deleted_at"), table_name="email_logs")
    op.drop_index(op.f("ix_email_logs_created_at"), table_name="email_logs")
    op.drop_table("email_logs")
