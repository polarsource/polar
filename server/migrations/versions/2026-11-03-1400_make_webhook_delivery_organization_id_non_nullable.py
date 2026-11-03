"""make webhook_deliveries organization_id non-nullable

Revision ID: 77c3feed3261
Revises: 2419b9b53df9
Create Date: 2026-11-03 14:00:00.000000

"""

import time

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "77c3feed3261"
down_revision = "2419b9b53df9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

CHECK_CONSTRAINT_NAME = "webhook_deliveries_organization_id_not_null"
LOCK_NOT_AVAILABLE = "55P03"
LOCK_ATTEMPTS = 30
LOCK_RETRY_DELAY_SECONDS = 2


def _execute_with_lock_retry(statement: str) -> None:
    # Webhook delivery workers hold locks on this table for the length of an
    # outbound HTTP call, so the ACCESS EXCLUSIVE lock is only grabbable in
    # the gaps between them. A short timeout keeps the queue behind us short.
    op.execute("SET lock_timeout = '2s'")
    for attempt in range(1, LOCK_ATTEMPTS + 1):
        try:
            op.execute(statement)
            return
        except sa.exc.DBAPIError as e:
            if (
                getattr(e.orig, "pgcode", None) != LOCK_NOT_AVAILABLE
                or attempt == LOCK_ATTEMPTS
            ):
                raise
            time.sleep(LOCK_RETRY_DELAY_SECONDS)


def _constraint_validated() -> bool | None:
    return op.get_bind().scalar(
        sa.text(
            "SELECT convalidated FROM pg_constraint "
            "WHERE conname = :name AND conrelid = 'webhook_deliveries'::regclass"
        ),
        {"name": CHECK_CONSTRAINT_NAME},
    )


def _column_not_null() -> bool:
    return bool(
        op.get_bind().scalar(
            sa.text(
                "SELECT attnotnull FROM pg_attribute "
                "WHERE attrelid = 'webhook_deliveries'::regclass "
                "AND attname = 'organization_id'"
            )
        )
    )


def upgrade() -> None:
    # A plain SET NOT NULL scans the whole table under ACCESS EXCLUSIVE.
    # Instead, validate a NOT VALID check constraint, which only takes
    # SHARE UPDATE EXCLUSIVE and doesn't block reads or writes. SET NOT NULL
    # then trusts the validated constraint and skips the scan.
    # Autocommit releases each ACCESS EXCLUSIVE lock as soon as its statement
    # is done, and lets a re-run resume without validating again.
    with op.get_context().autocommit_block():
        try:
            if not _column_not_null():
                validated = _constraint_validated()
                if validated is None:
                    _execute_with_lock_retry(
                        f"ALTER TABLE webhook_deliveries "
                        f"ADD CONSTRAINT {CHECK_CONSTRAINT_NAME} "
                        f"CHECK (organization_id IS NOT NULL) NOT VALID"
                    )
                if not validated:
                    op.execute("SET lock_timeout = '5min'")
                    op.execute(
                        f"ALTER TABLE webhook_deliveries "
                        f"VALIDATE CONSTRAINT {CHECK_CONSTRAINT_NAME}"
                    )
                _execute_with_lock_retry(
                    "ALTER TABLE webhook_deliveries "
                    "ALTER COLUMN organization_id SET NOT NULL"
                )
            _execute_with_lock_retry(
                f"ALTER TABLE webhook_deliveries "
                f"DROP CONSTRAINT IF EXISTS {CHECK_CONSTRAINT_NAME}"
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
