"""Update anonymized email domain

Revision ID: b7a3d4baf848
Revises: eee9c7fb3595
Create Date: 2026-02-12 08:39:07.218529

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b7a3d4baf848"
down_revision = "eee9c7fb3595"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE users
        SET email = REPLACE(email, '@anonymized.invalid', '@anonymized.polar.sh')
        WHERE email LIKE '%@anonymized.invalid'
        """
    )
    op.execute(
        """
        UPDATE customers
        SET email = REPLACE(email, '@anonymized.invalid', '@anonymized.polar.sh')
        WHERE email LIKE '%@anonymized.invalid'
        """
    )


def downgrade() -> None:
    pass
