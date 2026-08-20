"""drop oauth2_tokens.nonce column

Revision ID: 259333744d69
Revises: f3d81c25ab90
Create Date: 2026-08-19 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "259333744d69"
down_revision = "f3d81c25ab90"
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
