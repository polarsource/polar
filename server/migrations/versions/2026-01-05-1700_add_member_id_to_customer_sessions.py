"""Add member_id to customer_sessions

Revision ID: c34e9cbeb6a1
Revises: f3f36e914f4c
Create Date: 2026-01-05 17:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c34e9cbeb6a1"
down_revision = "f3f36e914f4c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "customer_sessions",
        sa.Column("member_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        "ix_customer_sessions_member_id",
        "customer_sessions",
        ["member_id"],
        unique=False,
    )
    op.create_foreign_key(
        "customer_sessions_member_id_fkey",
        "customer_sessions",
        "members",
        ["member_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "customer_sessions_member_id_fkey", "customer_sessions", type_="foreignkey"
    )
    op.drop_index("ix_customer_sessions_member_id", table_name="customer_sessions")
    op.drop_column("customer_sessions", "member_id")
