"""add authorization_parameters to sso connections

Revision ID: 153fe8dd72be
Revises: 9c921acecf88
Create Date: 2026-09-29 15:21:22.406991

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "153fe8dd72be"
down_revision = "9c921acecf88"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(
        """
        UPDATE organization_sso_connections
        SET configuration = configuration || '{"authorization_parameters": {}}'
        WHERE NOT configuration ? 'authorization_parameters'
        """
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
