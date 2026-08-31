"""enforce oauth_accounts.access_token_encrypted NOT NULL

Revision ID: c4e8a91b2d70
Revises: b58196b41f41
Create Date: 2026-08-31 10:15:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c4e8a91b2d70"
down_revision = "b58196b41f41"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    # Ciphertext cannot be filled with a SQL UPDATE (ADR-0006's usual
    # `WHERE col IS NULL` backfill). Production was drained by
    # `backfill_oauth_account_encrypted_tokens`; SET NOT NULL fails closed
    # if any row is still NULL.
    op.alter_column(
        "oauth_accounts",
        "access_token_encrypted",
        existing_type=sa.Text(),
        nullable=False,
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.alter_column(
        "oauth_accounts",
        "access_token_encrypted",
        existing_type=sa.Text(),
        nullable=True,
    )
