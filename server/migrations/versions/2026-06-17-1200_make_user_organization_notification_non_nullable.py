"""make user_organization.notification_settings non-nullable and drop organization.notification_settings

Revision ID: c4e1a9f3b2d7
Revises: 7a3f0b9c2d1e
Create Date: 2026-06-17 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c4e1a9f3b2d7"
down_revision = "7a3f0b9c2d1e"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")

    # Safety net: production rows are backfilled out-of-band by
    # `scripts/backfill_user_organization_notification_settings.py` before this
    # migration runs. This inline UPDATE covers any rows that script missed
    # (fresh/local/CI/sandbox), copying the value down from the organization so
    # the NOT NULL validation below can't trip on lingering NULLs. Idempotent —
    # a no-op once the backfill has already run.
    op.execute(
        """
        UPDATE user_organizations uo
            SET notification_settings = o.notification_settings
            FROM organizations o
            WHERE uo.organization_id = o.id
              AND uo.notification_settings IS NULL
        """
    )

    # Use the NOT VALID / VALIDATE pattern to avoid a full-table ACCESS EXCLUSIVE
    # lock when setting NOT NULL.
    #
    # Step 1: add the check constraint as NOT VALID — takes only SHARE UPDATE
    #         EXCLUSIVE, so concurrent reads and writes are unblocked.
    op.execute(
        """
        ALTER TABLE user_organizations
            ADD CONSTRAINT user_organizations_notification_settings_not_null
            CHECK (notification_settings IS NOT NULL) NOT VALID
        """
    )

    # Step 2: validate the constraint — also SHARE UPDATE EXCLUSIVE. Postgres
    #         scans the table for violations here, but concurrent DML is still
    #         allowed (it must simply not introduce new NULLs).
    op.execute(
        """
        ALTER TABLE user_organizations
            VALIDATE CONSTRAINT user_organizations_notification_settings_not_null
        """
    )

    # Step 3: set NOT NULL — because a validated check constraint already proves
    #         no NULLs exist, Postgres 12+ skips the full table scan and holds
    #         ACCESS EXCLUSIVE for only a very short time.
    op.alter_column(
        "user_organizations",
        "notification_settings",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=False,
    )

    # Step 4: the check constraint is now redundant — the NOT NULL column
    #         constraint takes over.
    op.execute(
        """
        ALTER TABLE user_organizations
            DROP CONSTRAINT user_organizations_notification_settings_not_null
        """
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.alter_column(
        "user_organizations",
        "notification_settings",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
    )
