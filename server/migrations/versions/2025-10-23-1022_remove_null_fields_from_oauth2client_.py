"""Remove null fields from OAuth2Client.client_metadata

Revision ID: bd5e68a512cd
Revises: 83351cd2dc0f
Create Date: 2025-10-23 10:22:30.329368

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "bd5e68a512cd"
down_revision = "83351cd2dc0f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE oauth2_clients
        SET client_metadata = COALESCE(
            (
                SELECT jsonb_object_agg(key, value)::text
                FROM jsonb_each(client_metadata::jsonb)
                WHERE value != 'null'::jsonb
            ),
            '{}'
        )
        WHERE client_metadata IS NOT NULL
        AND client_metadata != ''
        AND client_metadata::jsonb != '{}'::jsonb
        """
    )


def downgrade() -> None:
    pass
