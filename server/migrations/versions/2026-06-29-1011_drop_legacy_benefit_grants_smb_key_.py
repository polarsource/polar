"""drop legacy benefit_grants_smb_key constraint

Revision ID: 66438a5cfc91
Revises: e7118c4ae5d8
Create Date: 2026-06-29 10:11:48.340279

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "66438a5cfc91"
down_revision = "e7118c4ae5d8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

CONSTRAINT = "benefit_grants_smb_key"
COLUMNS = ["subscription_id", "member_id", "benefit_id"]


def upgrade() -> None:
    # Legacy non-partial constraint superseded by ix_benefit_grants_scope_unique
    # (member- and soft-delete-aware); it wrongly rejected legitimate re-grants.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(CONSTRAINT, "benefit_grants", type_="unique")


def downgrade() -> None:
    # Rarely-run rollback; fails loudly if duplicate (subscription, member, benefit)
    # rows accumulated since the drop rather than silently dropping grants.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_unique_constraint(CONSTRAINT, "benefit_grants", COLUMNS)
