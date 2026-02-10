"""Add License Key unique constraint

Revision ID: 519ab6f1dc5f
Revises: b43b68670937
Create Date: 2026-02-10 14:06:42.726959

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "519ab6f1dc5f"
down_revision = "b43b68670937"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    constraint_name = op.f("license_keys_organization_id_key_key")

    # Step 1: Create unique index CONCURRENTLY (doesn't lock the table)
    with op.get_context().autocommit_block():
        op.create_index(
            constraint_name,
            "license_keys",
            ["organization_id", "key"],
            unique=True,
            postgresql_concurrently=True,
        )

    # Step 2: Convert index to constraint using raw SQL
    op.execute(
        f"ALTER TABLE license_keys ADD CONSTRAINT {constraint_name} UNIQUE USING INDEX {constraint_name}"
    )


def downgrade() -> None:
    constraint_name = op.f("license_keys_organization_id_key_key")
    op.drop_constraint(constraint_name, "license_keys", type_="unique")
