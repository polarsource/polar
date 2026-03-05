"""Add sent_emails table

Revision ID: b3c4d5e6f7a8
Revises: a7f3e1c20b94
Create Date: 2026-03-02 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b3c4d5e6f7a8"
down_revision = "a7f3e1c20b94"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sent_emails",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "deleted_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column("type", sa.String(), nullable=True),
        sa.Column("processor", sa.String(), nullable=True),
        sa.Column("processor_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("to_email_addr", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("props", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("idempotency_key", sa.String(), nullable=True),
        sa.Column("sent_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("sent_emails_organization_id_fkey"),
            ondelete="set null",
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name=op.f("sent_emails_customer_id_fkey"),
            ondelete="set null",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("sent_emails_user_id_fkey"),
            ondelete="set null",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("sent_emails_pkey")),
    )
    op.create_index(
        op.f("ix_sent_emails_created_at"),
        "sent_emails",
        ["created_at"],
    )
    op.create_index(
        op.f("ix_sent_emails_deleted_at"),
        "sent_emails",
        ["deleted_at"],
    )
    op.create_index(
        op.f("ix_sent_emails_type"),
        "sent_emails",
        ["type"],
    )
    op.create_index(
        op.f("ix_sent_emails_organization_id"),
        "sent_emails",
        ["organization_id"],
    )
    op.create_index(
        op.f("ix_sent_emails_customer_id"),
        "sent_emails",
        ["customer_id"],
    )
    op.create_index(
        op.f("ix_sent_emails_user_id"),
        "sent_emails",
        ["user_id"],
    )
    op.create_index(
        "ix_sent_emails_idempotency_key",
        "sent_emails",
        ["idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_sent_emails_idempotency_key",
        table_name="sent_emails",
    )
    op.drop_index(
        op.f("ix_sent_emails_user_id"),
        table_name="sent_emails",
    )
    op.drop_index(
        op.f("ix_sent_emails_customer_id"),
        table_name="sent_emails",
    )
    op.drop_index(
        op.f("ix_sent_emails_organization_id"),
        table_name="sent_emails",
    )
    op.drop_index(
        op.f("ix_sent_emails_type"),
        table_name="sent_emails",
    )
    op.drop_index(
        op.f("ix_sent_emails_deleted_at"),
        table_name="sent_emails",
    )
    op.drop_index(
        op.f("ix_sent_emails_created_at"),
        table_name="sent_emails",
    )
    op.drop_table("sent_emails")
