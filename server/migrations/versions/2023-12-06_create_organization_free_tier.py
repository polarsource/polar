"""Create Organization Free Tier

Revision ID: 9df4f42400cd
Revises: 4eac1b2085fd
Create Date: 2023-12-06 15:34:56.073514

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "9df4f42400cd"
down_revision = "4eac1b2085fd"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # Create Public posts benefits
    op.execute(
        """
        INSERT INTO subscription_benefits (id, created_at, type, description, is_tax_applicable, properties, organization_id, repository_id)
        SELECT uuid_generate_v4(), NOW(), 'articles', 'Public posts', TRUE, '{"paid_articles": false}', id, NULL
        FROM organizations
        WHERE organizations.installation_id IS NOT NULL;
        """
    )

    # Create Free tiers
    op.execute(
        """
        INSERT INTO subscription_tiers (id, created_at, type, name, is_highlighted, price_amount, price_currency, is_archived, organization_id, repository_id)
        SELECT uuid_generate_v4(), NOW(), 'free', 'Free', FALSE, 0, 'USD', FALSE, id, NULL
        FROM organizations
        WHERE organizations.installation_id IS NOT NULL;
        """
    )

    # Associate each Free tiers to its Free post benefit
    op.execute(
        """
        INSERT INTO subscription_tier_benefits (id, created_at, subscription_tier_id, subscription_benefit_id, "order")
        SELECT uuid_generate_v4(), NOW(), subscription_tiers.id, subscription_benefits.id, 0
        FROM subscription_tiers
        LEFT JOIN subscription_benefits ON subscription_benefits.organization_id = subscription_tiers.organization_id
        WHERE subscription_tiers.type = 'free' AND subscription_benefits.type = 'articles';
        """
    )

    # Create Premium posts benefits
    op.execute(
        """
        INSERT INTO subscription_benefits (id, created_at, type, description, is_tax_applicable, properties, organization_id, repository_id)
        SELECT uuid_generate_v4(), NOW(), 'articles', 'Premium posts', TRUE, '{"paid_articles": true}', id, NULL
        FROM organizations
        WHERE organizations.installation_id IS NOT NULL;
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM subscription_benefits WHERE type = 'articles'")
    op.execute("DELETE FROM subscription_tiers WHERE type = 'free'")
