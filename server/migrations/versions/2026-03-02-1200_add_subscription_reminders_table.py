"""Add subscription_reminders table

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
        "subscription_reminders",
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
        sa.Column("subscription_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("target_date", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("sent_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["subscription_id"],
            ["subscriptions.id"],
            name=op.f("subscription_reminders_subscription_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("subscription_reminders_pkey")),
        sa.UniqueConstraint(
            "subscription_id",
            "type",
            "target_date",
            name="subscription_reminders_unique",
        ),
    )
    op.create_index(
        op.f("ix_subscription_reminders_created_at"),
        "subscription_reminders",
        ["created_at"],
    )
    op.create_index(
        op.f("ix_subscription_reminders_deleted_at"),
        "subscription_reminders",
        ["deleted_at"],
    )
    op.create_index(
        op.f("ix_subscription_reminders_subscription_id"),
        "subscription_reminders",
        ["subscription_id"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_subscription_reminders_subscription_id"),
        table_name="subscription_reminders",
    )
    op.drop_index(
        op.f("ix_subscription_reminders_deleted_at"),
        table_name="subscription_reminders",
    )
    op.drop_index(
        op.f("ix_subscription_reminders_created_at"),
        table_name="subscription_reminders",
    )
    op.drop_table("subscription_reminders")
