"""add SlackApp encrypted secret columns

Revision ID: b181f0be8208
Revises: 31d662178679
Create Date: 2026-07-02 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b181f0be8208"
down_revision = "31d662178679"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "slack_apps",
        sa.Column("client_secret_encrypted", sa.Text(), nullable=True),
    )
    op.add_column(
        "slack_apps",
        sa.Column("signing_secret_encrypted", sa.Text(), nullable=True),
    )
    op.add_column(
        "slack_apps",
        sa.Column("bot_token_encrypted", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("slack_apps", "bot_token_encrypted")
    op.drop_column("slack_apps", "signing_secret_encrypted")
    op.drop_column("slack_apps", "client_secret_encrypted")
