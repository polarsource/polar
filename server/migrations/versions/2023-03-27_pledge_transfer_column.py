"""pledge transfer column

Revision ID: f8589f130a0f
Revises: 9f8a3c698423
Create Date: 2023-03-27 15:22:23.094945

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f8589f130a0f"
down_revision = "9f8a3c698423"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pledges", sa.Column("transfer_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("pledges", "transfer_id")
