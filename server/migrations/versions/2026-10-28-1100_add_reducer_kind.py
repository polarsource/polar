"""Add reducer kind

Revision ID: 046b436207ff
Revises: a78f3131b283
Create Date: 2026-10-28 10:51:22.272059

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "046b436207ff"
down_revision = "a78f3131b283"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column("reducers", sa.Column("kind", sa.String(), nullable=True))


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("reducers", "kind")
