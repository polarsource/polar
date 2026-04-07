"""member_email_case_insensitive_index

Revision ID: 32c17499cb60
Revises: 0d5be76ae2b2
Create Date: 2026-04-01 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "32c17499cb60"
down_revision = "0d5be76ae2b2"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Create new case-insensitive index concurrently first
    with op.get_context().autocommit_block():
        op.create_index(
            "members_customer_id_email_case_insensitive_active_key",
            "members",
            ["customer_id", sa.text("lower(email)")],
            unique=True,
            postgresql_where="deleted_at IS NULL",
            postgresql_concurrently=True,
        )

    # Then drop the old case-sensitive index
    op.drop_index(
        "members_customer_id_email_active_key",
        table_name="members",
    )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            "members_customer_id_email_active_key",
            "members",
            ["customer_id", "email"],
            unique=True,
            postgresql_where="deleted_at IS NULL",
            postgresql_concurrently=True,
        )

    op.drop_index(
        "members_customer_id_email_case_insensitive_active_key",
        table_name="members",
    )
