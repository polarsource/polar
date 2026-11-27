"""Enforce reducer kind not null

Revision ID: 2f0166e64014
Revises: 046b436207ff
Create Date: 2026-10-28 11:31:49.186798

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "2f0166e64014"
down_revision = "046b436207ff"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute("UPDATE reducers SET kind = 'usage' WHERE kind IS NULL")
    op.alter_column("reducers", "kind", existing_type=sa.VARCHAR(), nullable=False)


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.alter_column("reducers", "kind", existing_type=sa.VARCHAR(), nullable=True)
