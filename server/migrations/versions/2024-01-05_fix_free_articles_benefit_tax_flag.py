"""Fix free articles benefit tax flag

Revision ID: 81a9b494f9d5
Revises: ce178fc3ee8e
Create Date: 2024-01-05 10:54:23.485434

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "81a9b494f9d5"
down_revision = "ce178fc3ee8e"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE subscription_benefits
        SET is_tax_applicable = FALSE
        WHERE type = 'articles' AND CAST (properties ->> 'paid_articles' AS BOOLEAN) IS FALSE;
    """
    )


def downgrade() -> None:
    pass
