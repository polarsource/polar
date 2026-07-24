"""Make custom_fields slug uniqueness ignore soft-deleted rows

Revision ID: d3f5a9c47e21
Revises: fef393bb1f53
Create Date: 2026-07-03 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d3f5a9c47e21"
down_revision = "fef393bb1f53"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(
        "custom_fields_slug_organization_id_key", "custom_fields", type_="unique"
    )
    op.create_index(
        "custom_fields_slug_organization_id_active_key",
        "custom_fields",
        ["slug", "organization_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index(
        "custom_fields_slug_organization_id_active_key",
        table_name="custom_fields",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_unique_constraint(
        "custom_fields_slug_organization_id_key",
        "custom_fields",
        ["slug", "organization_id"],
    )
