"""index trial_redemptions lower(customer_email)

Revision ID: 3f9c1a7e2b4d
Revises: edad465d12f6
Create Date: 2026-11-05 11:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "3f9c1a7e2b4d"
down_revision = "edad465d12f6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                "ix_trial_redemptions_customer_email_lower",
                table_name="trial_redemptions",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                "ix_trial_redemptions_customer_email_lower",
                "trial_redemptions",
                [sa.text("lower(customer_email)")],
                postgresql_concurrently=True,
            )
            op.drop_index(
                "ix_trial_redemptions_customer_email",
                table_name="trial_redemptions",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.create_index(
                "ix_trial_redemptions_customer_email",
                "trial_redemptions",
                ["customer_email"],
                if_not_exists=True,
                postgresql_concurrently=True,
            )
            op.drop_index(
                "ix_trial_redemptions_customer_email_lower",
                table_name="trial_redemptions",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")
