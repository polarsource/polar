"""Fix Organization.subscription_settings

Revision ID: 13d285d30848
Revises: e9f5351f567c
Create Date: 2025-02-06 09:49:00.612293

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "13d285d30848"
down_revision = "e9f5351f567c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("""
        UPDATE organizations
        SET subscription_settings = '{"allow_multiple_subscriptions": true, "allow_customer_updates": true, "proration_behavior": "prorate"}'::jsonb
        WHERE subscription_settings = 'null'::jsonb
    """)


def downgrade() -> None:
    pass
