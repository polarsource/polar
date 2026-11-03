"""add organization_id to webhook_deliveries

Revision ID: 2419b9b53df9
Revises: 3b83f6b7a95c
Create Date: 2026-11-03 13:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "2419b9b53df9"
down_revision = "3b83f6b7a95c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    # A single statement: Postgres skips the FK validation scan for a column
    # it is adding, so the constraint is created valid without reading the table.
    op.execute(
        "ALTER TABLE webhook_deliveries ADD COLUMN organization_id UUID "
        "CONSTRAINT webhook_deliveries_organization_id_fkey "
        "REFERENCES organizations(id) ON DELETE CASCADE"
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("webhook_deliveries", "organization_id")
