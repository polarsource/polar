"""Add CustomerMeter indices

Revision ID: 5155c7a0d153
Revises: 52b2bd17adcf
Create Date: 2025-04-10 13:48:40.900391

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5155c7a0d153"
down_revision = "52b2bd17adcf"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_index(
        op.f("ix_customer_meters_balance"), "customer_meters", ["balance"], unique=False
    )
    op.create_index(
        op.f("ix_customer_meters_consumed_units"),
        "customer_meters",
        ["consumed_units"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_meters_credited_units"),
        "customer_meters",
        ["credited_units"],
        unique=False,
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(
        op.f("ix_customer_meters_credited_units"), table_name="customer_meters"
    )
    op.drop_index(
        op.f("ix_customer_meters_consumed_units"), table_name="customer_meters"
    )
    op.drop_index(op.f("ix_customer_meters_balance"), table_name="customer_meters")
    # ### end Alembic commands ###
