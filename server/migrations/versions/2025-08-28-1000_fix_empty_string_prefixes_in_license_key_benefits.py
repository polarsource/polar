"""fix empty string prefixes in license key benefits

Revision ID: a1b2c3d4e5f6
Revises: 15fd38497594
Create Date: 2025-08-28 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "15fd38497594"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    """Fix existing license key benefits with empty string prefixes."""
    # Update benefits where type='license_keys' and properties->>'prefix' is empty string
    # Set properties = jsonb_set(properties, '{prefix}', 'null'::jsonb) where properties->>'prefix' = ''
    op.execute("""
        UPDATE benefits 
        SET properties = jsonb_set(properties, '{prefix}', 'null'::jsonb)
        WHERE type = 'license_keys' 
        AND properties->>'prefix' = ''
    """)


def downgrade() -> None:
    """Reverse the operation - set null prefixes back to empty strings."""
    # This is a lossy operation since we can't distinguish between originally null
    # and originally empty string values, but we'll set them back to empty strings
    op.execute("""
        UPDATE benefits 
        SET properties = jsonb_set(properties, '{prefix}', '""'::jsonb)
        WHERE type = 'license_keys' 
        AND properties->>'prefix' IS NULL
        AND properties ? 'prefix'
    """)
