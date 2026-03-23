"""Make customer.email nullable — create partial indexes

Revision ID: cae16e5e72ec
Revises: 6081ae0dd6ef
Create Date: 2026-03-20 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "cae16e5e72ec"
down_revision = "6081ae0dd6ef"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_customers_email_not_null",
            "customers",
            [sa.literal_column("lower(email)"), "deleted_at"],
            unique=False,
            postgresql_where="email IS NOT NULL",
            postgresql_nulls_not_distinct=True,
            postgresql_concurrently=True,
            if_not_exists=True,
        )
        op.create_index(
            "ix_customers_organization_id_email_not_null",
            "customers",
            ["organization_id", sa.literal_column("lower(email)"), "deleted_at"],
            unique=True,
            postgresql_where="email IS NOT NULL",
            postgresql_nulls_not_distinct=True,
            postgresql_concurrently=True,
            if_not_exists=True,
        )


def downgrade() -> None:
    op.drop_index(
        "ix_customers_organization_id_email_not_null",
        table_name="customers",
    )
    op.drop_index(
        "ix_customers_email_not_null",
        table_name="customers",
    )
