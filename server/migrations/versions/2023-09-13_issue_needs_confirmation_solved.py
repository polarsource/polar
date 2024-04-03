"""issue.needs_confirmation_solved

Revision ID: 06ac1d084d1b
Revises: acf4ea846f4d
Create Date: 2023-09-13 17:59:05.305930

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "06ac1d084d1b"
down_revision = "acf4ea846f4d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "issues", sa.Column("needs_confirmation_solved", sa.Boolean(), nullable=True)
    )
    op.execute("UPDATE issues SET needs_confirmation_solved=false")
    op.execute(
        "UPDATE issues SET needs_confirmation_solved=true WHERE id IN (select distinct issue_id from pledges where state = 'confirmation_pending')"
    )
    op.alter_column("issues", "needs_confirmation_solved", nullable=False)
    op.execute("UPDATE pledges SET state='created' WHERE state='confirmation_pending'")


def downgrade() -> None:
    op.drop_column("issues", "needs_confirmation_solved")
