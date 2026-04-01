"""member_email_case_insensitive_index

Revision ID: a1b2c3d4e5f6
Revises: 0d5be76ae2b2
Create Date: 2026-04-01 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "0d5be76ae2b2"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.drop_index(
        "members_customer_id_email_active_key",
        table_name="members",
    )
    op.create_index(
        "members_customer_id_email_case_insensitive_active_key",
        "members",
        ["customer_id", sa.text("lower(email)")],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "members_customer_id_email_case_insensitive_active_key",
        table_name="members",
    )
    op.create_index(
        "members_customer_id_email_active_key",
        "members",
        ["customer_id", "email"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
