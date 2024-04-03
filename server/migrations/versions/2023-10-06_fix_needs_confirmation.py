"""fix_needs_confirmation

Revision ID: f7387326a45a
Revises: 754943765066
Create Date: 2023-10-06 13:24:40.229778

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "f7387326a45a"
down_revision = "754943765066"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Some issues in production are in a (now) impossible state
    # Remove needs_confirmation_solved for issues without pledges
    op.execute(
        "update issues set needs_confirmation_solved = false where needs_confirmation_solved = true and pledged_amount_sum = 0"
    )
    pass


def downgrade() -> None:
    pass
