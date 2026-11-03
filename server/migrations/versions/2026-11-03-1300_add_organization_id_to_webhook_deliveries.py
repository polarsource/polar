"""add organization_id to webhook_deliveries

Revision ID: 2419b9b53df9
Revises: 3b83f6b7a95c
Create Date: 2026-11-03 13:00:00.000000

"""

import sqlalchemy as sa
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
    op.add_column(
        "webhook_deliveries", sa.Column("organization_id", sa.Uuid(), nullable=True)
    )
    # NOT VALID skips scanning existing rows; new writes are still checked.
    op.create_foreign_key(
        op.f("webhook_deliveries_organization_id_fkey"),
        "webhook_deliveries",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="CASCADE",
        postgresql_not_valid=True,
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(
        op.f("webhook_deliveries_organization_id_fkey"),
        "webhook_deliveries",
        type_="foreignkey",
    )
    op.drop_column("webhook_deliveries", "organization_id")
