"""Add perks marketplace tables.

Revision ID: 2026012818001
Revises: 5c9d3e4f6a7b
Create Date: 2026-01-28 18:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "2026012818001"
down_revision = "5c9d3e4f6a7b"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Create perks table for startup stack marketplace
    op.create_table(
        "perks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        # Provider details
        sa.Column("provider_name", sa.String(255), nullable=False),
        sa.Column(
            "logo_key",
            sa.String(100),
            nullable=False,
            comment="Filename for /assets/images/perks/[logo_key].png",
        ),
        # Perk content
        sa.Column(
            "headline", sa.String(255), nullable=False, comment="e.g. '$5k in Credits'"
        ),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        # Redemption
        sa.Column("redemption_type", sa.String(20), nullable=False),
        sa.Column(
            "redemption_url",
            sa.Text(),
            nullable=True,
            comment="URL to visit for link-type redemption",
        ),
        sa.Column(
            "redemption_code",
            sa.String(255),
            nullable=True,
            comment="Code to copy for code-type redemption",
        ),
        # Display
        sa.Column("featured", sa.Boolean(), nullable=False, default=False),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=False,
            default=100,
            comment="Lower values appear first",
        ),
        # Status
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        # Standard timestamps
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_perks_category", "perks", ["category"])
    op.create_index("ix_perks_featured", "perks", ["featured"])
    op.create_index("ix_perks_is_active", "perks", ["is_active"])
    op.create_index("ix_perks_display_order", "perks", ["display_order"])
    op.create_index("ix_perks_created_at", "perks", ["created_at"])

    # Create perk_claims table to track user claims for analytics
    op.create_table(
        "perk_claims",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "perk_id",
            sa.Uuid(),
            sa.ForeignKey("perks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Standard timestamps
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_perk_claims_perk_id", "perk_claims", ["perk_id"])
    op.create_index("ix_perk_claims_user_id", "perk_claims", ["user_id"])
    op.create_index("ix_perk_claims_created_at", "perk_claims", ["created_at"])

    # Seed the "Power 5" perks
    op.execute(
        """
        INSERT INTO perks (
            id, provider_name, logo_key, headline, description, category,
            redemption_type, redemption_url, redemption_code, featured,
            display_order, is_active, created_at
        ) VALUES
        (
            gen_random_uuid(),
            'AWS',
            'aws',
            '$5,000 in Credits',
            'Get up to $5,000 in AWS Activate credits for your startup. Access 80+ services including compute, storage, and machine learning.',
            'cloud',
            'link',
            'https://aws.amazon.com/activate/',
            NULL,
            true,
            1,
            true,
            NOW()
        ),
        (
            gen_random_uuid(),
            'OpenAI',
            'openai',
            '$2,500 in Credits',
            'Access GPT-4, DALL-E, and other cutting-edge AI models with $2,500 in API credits for your startup.',
            'ai',
            'link',
            'https://openai.com/startup',
            NULL,
            false,
            2,
            true,
            NOW()
        ),
        (
            gen_random_uuid(),
            'Mercury',
            'mercury',
            '$500 Bonus',
            'Open a Mercury business banking account and receive a $500 bonus. Banking built for startups with unlimited transactions.',
            'finance',
            'link',
            'https://mercury.com/partner/spaire',
            NULL,
            true,
            3,
            true,
            NOW()
        ),
        (
            gen_random_uuid(),
            'Stripe Atlas',
            'stripe',
            '$500 Discount',
            'Incorporate your startup in Delaware with Stripe Atlas. Get $500 off incorporation fees plus access to Stripe''s startup toolkit.',
            'finance',
            'code',
            NULL,
            'SPAIRE500',
            false,
            4,
            true,
            NOW()
        ),
        (
            gen_random_uuid(),
            'HubSpot',
            'hubspot',
            '90% Off First Year',
            'Get 90% off HubSpot''s CRM, marketing, and sales tools for your first year. Includes up to 5 users and premium features.',
            'marketing',
            'code',
            NULL,
            'SPAIRE90',
            false,
            5,
            true,
            NOW()
        )
        """
    )


def downgrade() -> None:
    op.drop_table("perk_claims")
    op.drop_table("perks")
