"""drop pledge_transactions table

Revision ID: d54b19ea954c
Revises: b3e8f1a92c47
Create Date: 2026-08-12 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d54b19ea954c"
down_revision = "b3e8f1a92c47"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.drop_index(
        op.f("ix_pledge_transactions_deleted_at"),
        table_name="pledge_transactions",
    )
    op.drop_index(
        op.f("ix_pledge_transactions_created_at"),
        table_name="pledge_transactions",
    )
    op.drop_table("pledge_transactions")


def downgrade() -> None:
    op.create_table(
        "pledge_transactions",
        sa.Column("pledge_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("transaction_id", sa.String(), nullable=True),
        sa.Column("issue_reward_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["issue_reward_id"],
            ["issue_rewards.id"],
            name=op.f("pledge_transactions_issue_reward_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["pledge_id"],
            ["pledges.id"],
            name=op.f("pledge_transactions_pledge_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pledge_transactions_pkey")),
    )
    op.create_index(
        op.f("ix_pledge_transactions_created_at"),
        "pledge_transactions",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pledge_transactions_deleted_at"),
        "pledge_transactions",
        ["deleted_at"],
        unique=False,
    )
