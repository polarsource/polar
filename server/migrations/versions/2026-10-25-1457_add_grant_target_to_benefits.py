"""add grant_target to benefits

Revision ID: cd381778dcb7
Revises: 9c3e7a1d5b24
Create Date: 2026-10-25 14:57:56.347788

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "cd381778dcb7"
down_revision = "9c3e7a1d5b24"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "benefits",
        sa.Column(
            "grant_target",
            sa.String(),
            server_default="member",
            nullable=False,
        ),
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("benefits", "grant_target")
