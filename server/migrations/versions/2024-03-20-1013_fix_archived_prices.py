"""Fix archived prices

Revision ID: 2b1a16d5661f
Revises: 281fb5f68451
Create Date: 2024-03-20 10:13:50.481733

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.orm import Session

from polar.integrations.stripe.service import stripe as stripe_service

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "2b1a16d5661f"
down_revision = "281fb5f68451"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    session = Session(bind=op.get_bind())
    statement = sa.text(
        """
        SELECT id, stripe_price_id FROM subscription_tier_prices
        """
    )
    result = session.execute(statement)
    for id, stripe_price_id in result.all():
        stripe_price = stripe_service.get_price(stripe_price_id)
        if not stripe_price.active:
            session.execute(
                sa.text(
                    """
                    UPDATE subscription_tier_prices
                    SET is_archived = true
                    WHERE id = :id
                    """
                ),
                {"id": id},
            )


def downgrade() -> None:
    pass
