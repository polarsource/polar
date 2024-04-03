"""change repo badge setting

Revision ID: 51818b6106c9
Revises: b7500de3b0d3
Create Date: 2023-05-27 21:52:45.410925

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "51818b6106c9"
down_revision = "b7500de3b0d3"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "repositories",
        "pledge_badge",
        new_column_name="pledge_badge_auto_embed",
    )


def downgrade() -> None:
    op.alter_column(
        "repositories",
        "pledge_badge_auto_embed",
        new_column_name="pledge_badge",
    )
