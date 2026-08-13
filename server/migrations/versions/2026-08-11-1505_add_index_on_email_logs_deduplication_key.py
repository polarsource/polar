"""add index on email_logs deduplication_key

Revision ID: 89e805c471b0
Revises: 9a1c47f0b3d2
Create Date: 2026-08-11 15:05:09.141659

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "89e805c471b0"
down_revision = "9a1c47f0b3d2"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX = "ix_email_logs_deduplication_key"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # Drop any INVALID leftover from an interrupted concurrent build first.
        op.drop_index(
            INDEX,
            table_name="email_logs",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            INDEX,
            "email_logs",
            ["deduplication_key"],
            postgresql_where="deduplication_key IS NOT NULL",
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX,
            table_name="email_logs",
            if_exists=True,
            postgresql_concurrently=True,
        )
