"""Set OAuth2 Clients default_sub_type

Revision ID: 10baf05ea3ef
Revises: 244e5c74a471
Create Date: 2025-10-16 09:19:34.774408

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "10baf05ea3ef"
down_revision = "244e5c74a471"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE oauth2_clients
        SET client_metadata = jsonb_set(
            client_metadata::jsonb,
            '{default_sub_type}',
            '"user"',
            true
        )::text
        WHERE client_metadata::jsonb ->> 'default_sub_type' IS NULL
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE oauth2_clients
        SET client_metadata = (client_metadata::jsonb - 'default_sub_type')::text
        """
    )
