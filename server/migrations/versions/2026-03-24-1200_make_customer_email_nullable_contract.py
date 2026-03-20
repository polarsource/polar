"""Make customer.email nullable — drop old indexes (contract)

Revision ID: ec653d290f81
Revises: 1a2e0acc75e3
Create Date: 2026-03-24 12:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "ec653d290f81"
down_revision = "1a2e0acc75e3"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.drop_index(
        "ix_customers_organization_id_email_case_insensitive",
        table_name="customers",
    )
    op.drop_index(
        "ix_customers_email_case_insensitive",
        table_name="customers",
    )


def downgrade() -> None:
    import sqlalchemy as sa

    op.create_index(
        "ix_customers_email_case_insensitive",
        "customers",
        [sa.literal_column("lower(email)"), "deleted_at"],
        unique=False,
        postgresql_nulls_not_distinct=True,
    )
    op.create_index(
        "ix_customers_organization_id_email_case_insensitive",
        "customers",
        ["organization_id", sa.literal_column("lower(email)"), "deleted_at"],
        unique=True,
        postgresql_nulls_not_distinct=True,
    )
