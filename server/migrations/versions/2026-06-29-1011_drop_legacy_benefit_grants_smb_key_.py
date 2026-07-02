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
    # benefit_grants_smb_key (subscription_id, member_id, benefit_id) is a legacy
    # non-partial unique constraint that contradicts ix_benefit_grants_scope_unique
    # (the member-aware, deleted-aware partial index that already prevents duplicate
    # grants). Because smb_key ignores customer_id/order_id and still applies to
    # revoked/soft-deleted rows, it rejected legitimate re-grants (after soft-delete,
    # or for seat/customer reassignment) and lost concurrent-grant races, raising
    # IntegrityError. Drop it and rely on ix_benefit_grants_scope_unique.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(CONSTRAINT, "benefit_grants", type_="unique")


def downgrade() -> None:
    # Rarely-run rollback. Recreating the constraint fails loudly if duplicate
    # (subscription, member, benefit) rows have accumulated since the drop, rather
    # than silently dropping grants. Runs in a single transaction so a failure
    # leaves ix_benefit_grants_scope_unique in place as the uniqueness guard.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_unique_constraint(CONSTRAINT, "benefit_grants", COLUMNS)
