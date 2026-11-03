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

CONSTRAINT_NAME = "webhook_deliveries_organization_id_fkey"


def upgrade() -> None:
    # Each step commits on its own, so the short lock the FK takes is released
    # before VALIDATE scans the table under a lock that blocks no writes.
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.execute(
                "ALTER TABLE webhook_deliveries "
                "ADD COLUMN IF NOT EXISTS organization_id UUID"
            )

            validated: bool | None = None
            if not op.get_context().as_sql:
                validated = op.get_bind().scalar(
                    sa.text(
                        "SELECT convalidated FROM pg_constraint "
                        f"WHERE conname = '{CONSTRAINT_NAME}' "
                        "AND conrelid = 'webhook_deliveries'::regclass"
                    )
                )

            if validated is None:
                op.create_foreign_key(
                    op.f(CONSTRAINT_NAME),
                    "webhook_deliveries",
                    "organizations",
                    ["organization_id"],
                    ["id"],
                    ondelete="CASCADE",
                    postgresql_not_valid=True,
                )
            if not validated:
                op.execute(
                    "ALTER TABLE webhook_deliveries "
                    f"VALIDATE CONSTRAINT {CONSTRAINT_NAME}"
                )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.drop_constraint(
                op.f(CONSTRAINT_NAME),
                "webhook_deliveries",
                type_="foreignkey",
                if_exists=True,
            )
            op.execute(
                "ALTER TABLE webhook_deliveries DROP COLUMN IF EXISTS organization_id"
            )
        finally:
            op.execute("RESET lock_timeout")
