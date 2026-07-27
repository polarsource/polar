"""add OAuth2Client encrypted secret columns

Revision ID: cddb6a1cfd92
Revises: 40d0bc3f9994
Create Date: 2026-07-08 17:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "cddb6a1cfd92"
down_revision = "40d0bc3f9994"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "oauth2_clients",
        sa.Column("client_secret_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "oauth2_clients",
        sa.Column("client_secret_encrypted", sa.Text(), nullable=True),
    )
    op.add_column(
        "oauth2_clients",
        sa.Column(
            "registration_access_token_hash", sa.String(length=64), nullable=True
        ),
    )
    op.add_column(
        "oauth2_clients",
        sa.Column("registration_access_token_encrypted", sa.Text(), nullable=True),
    )
    op.create_index(
        op.f("ix_oauth2_clients_client_secret_hash"),
        "oauth2_clients",
        ["client_secret_hash"],
        unique=False,
    )
    op.create_index(
        op.f("ix_oauth2_clients_registration_access_token_hash"),
        "oauth2_clients",
        ["registration_access_token_hash"],
        unique=False,
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index(
        op.f("ix_oauth2_clients_registration_access_token_hash"),
        table_name="oauth2_clients",
    )
    op.drop_index(
        op.f("ix_oauth2_clients_client_secret_hash"),
        table_name="oauth2_clients",
    )
    op.drop_column("oauth2_clients", "registration_access_token_encrypted")
    op.drop_column("oauth2_clients", "registration_access_token_hash")
    op.drop_column("oauth2_clients", "client_secret_encrypted")
    op.drop_column("oauth2_clients", "client_secret_hash")
