"""Fix customer indexes for recycling

Revision ID: 68717eb3943c
Revises: 00fc15c4d5f4
Create Date: 2025-03-11 13:38:44.219522

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "68717eb3943c"
down_revision = "fcd7238f2659"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index("ix_customers_email_case_insensitive", table_name="customers")
    op.create_index(
        "ix_customers_email_case_insensitive",
        "customers",
        [sa.literal_column("lower(email)"), "deleted_at"],
        unique=False,
        postgresql_nulls_not_distinct=True,
    )
    op.drop_index(
        "ix_customers_organization_id_email_case_insensitive", table_name="customers"
    )
    op.create_index(
        "ix_customers_organization_id_email_case_insensitive",
        "customers",
        ["organization_id", sa.literal_column("lower(email)"), "deleted_at"],
        unique=True,
        postgresql_nulls_not_distinct=True,
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # Cannot downgrade this change.
    #
    # We cannot re-introduce a unique index without `deleted_at` since we could
    # have multiple customers with the same email after the upgrade (soft
    # deleted) with references to orders, subscriptions etc.
    #
    # Any revert would need to take this new data model into account vs. a
    # strict index as before.
    ...
