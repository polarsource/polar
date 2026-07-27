"""unique index on dispute transactions

Revision ID: 3955b27539d3
Revises: cddb6a1cfd92
Create Date: 2026-07-15 11:02:17.457273

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "3955b27539d3"
down_revision = "cddb6a1cfd92"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


INDEX = "ix_dispute_transaction_dispute_id_uniqueness"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # Drop any INVALID leftover from an interrupted concurrent build first.
        op.drop_index(
            INDEX,
            table_name="transactions",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            INDEX,
            "transactions",
            ["type", "dispute_id"],
            unique=True,
            postgresql_where="type = 'dispute'",
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX,
            table_name="transactions",
            if_exists=True,
            postgresql_concurrently=True,
        )
