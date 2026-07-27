"""enforce organizations.sso_enforced NOT NULL

Revision ID: 31d662178679
Revises: 6cd2cda5a8a0
Create Date: 2026-07-01 17:21:13.325483

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "31d662178679"
down_revision = "6cd2cda5a8a0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    # Backfill remaining NULLs so the migration is self-contained (fresh/local DBs
    # and any stragglers). In production, run
    # scripts.backfill_organization_sso_enforced --execute first so this UPDATE
    # matches no rows and doesn't rewrite the table under lock.
    op.execute(
        "UPDATE organizations SET sso_enforced = false WHERE sso_enforced IS NULL"
    )
    op.alter_column(
        "organizations", "sso_enforced", existing_type=sa.Boolean(), nullable=False
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.alter_column(
        "organizations", "sso_enforced", existing_type=sa.Boolean(), nullable=True
    )
