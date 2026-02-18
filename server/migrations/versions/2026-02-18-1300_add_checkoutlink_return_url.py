"""Add CheckoutLink.return_url

Revision ID: a13077e7c985
Revises: 07d3ab839aee
Create Date: 2026-02-15 14:07:07.845083

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a13077e7c985"
down_revision = "07d3ab839aee"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column("checkout_links", sa.Column("return_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("checkout_links", "return_url")
