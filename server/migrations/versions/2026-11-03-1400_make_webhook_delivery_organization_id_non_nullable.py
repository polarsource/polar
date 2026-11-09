"""make webhook_deliveries organization_id non-nullable

Revision ID: 77c3feed3261
Revises: 2419b9b53df9
Create Date: 2026-11-03 14:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "77c3feed3261"
down_revision = "2419b9b53df9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

CHECK_CONSTRAINT_NAME = "webhook_deliveries_organization_id_not_null"


def upgrade() -> None:
    # A plain SET NOT NULL scans the whole table under ACCESS EXCLUSIVE.
    # Instead, validate a NOT VALID check constraint, which only takes
    # SHARE UPDATE EXCLUSIVE and doesn't block reads or writes. SET NOT NULL
    # then trusts the validated constraint and skips the scan.
    # Autocommit releases the ACCESS EXCLUSIVE lock taken by ADD CONSTRAINT
    # before VALIDATE scans the table; one transaction would hold it throughout.
    with op.get_context().autocommit_block():
        try:
            op.execute("SET lock_timeout = '5s'")
            op.execute(
                f"ALTER TABLE webhook_deliveries "
                f"DROP CONSTRAINT IF EXISTS {CHECK_CONSTRAINT_NAME}"
            )
            op.execute(
                f"ALTER TABLE webhook_deliveries ADD CONSTRAINT {CHECK_CONSTRAINT_NAME} "
                f"CHECK (organization_id IS NOT NULL) NOT VALID"
            )

            op.execute("SET lock_timeout = '5min'")
            op.execute(
                f"ALTER TABLE webhook_deliveries "
                f"VALIDATE CONSTRAINT {CHECK_CONSTRAINT_NAME}"
            )

            op.execute("SET lock_timeout = '5s'")
            op.execute(
                "ALTER TABLE webhook_deliveries "
                "ALTER COLUMN organization_id SET NOT NULL"
            )
            op.execute(
                f"ALTER TABLE webhook_deliveries DROP CONSTRAINT {CHECK_CONSTRAINT_NAME}"
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(
        "ALTER TABLE webhook_deliveries ALTER COLUMN organization_id DROP NOT NULL"
    )
