"""add OAuthAccount encrypted token columns

Revision ID: 42886ceacac8
Revises: f159733f3ae6
Create Date: 2026-07-01 09:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "42886ceacac8"
down_revision = "f159733f3ae6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "oauth_accounts",
        sa.Column("access_token_encrypted", sa.Text(), nullable=True),
    )
    op.add_column(
        "oauth_accounts",
        sa.Column("refresh_token_encrypted", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("oauth_accounts", "refresh_token_encrypted")
    op.drop_column("oauth_accounts", "access_token_encrypted")
