"""drop oauth2_tokens.nonce column

Revision ID: a1b2c3d4e5f6
Revises: c7f2a91e4d38
Create Date: 2026-08-19 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "c7f2a91e4d38"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.drop_index(op.f("ix_oauth2_tokens_nonce"), table_name="oauth2_tokens")
    op.drop_column("oauth2_tokens", "nonce")


def downgrade() -> None:
    op.add_column("oauth2_tokens", sa.Column("nonce", sa.String(), nullable=True))
    op.create_index(
        op.f("ix_oauth2_tokens_nonce"), "oauth2_tokens", ["nonce"], unique=False
    )
