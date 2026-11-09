"""make users.is_admin nullable

Revision ID: c503229afd0f
Revises: e9bc66a27bbd
Create Date: 2026-11-09 12:47:12.512572

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c503229afd0f"
down_revision = "e9bc66a27bbd"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.alter_column(
        "users",
        "is_admin",
        existing_type=sa.Boolean(),
        nullable=True,
        server_default=sa.false(),
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute("UPDATE users SET is_admin = false WHERE is_admin IS NULL")
    op.alter_column(
        "users",
        "is_admin",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=None,
    )
