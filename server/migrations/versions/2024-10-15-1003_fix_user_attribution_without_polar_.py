"""fix user attribution without polar subscription

Revision ID: 4f890422b67a
Revises: e283628da3fc
Create Date: 2024-10-15 10:03:14.641317

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "4f890422b67a"
down_revision = "e283628da3fc"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Set historical signup intents
    op.execute(
        """
        WITH user_pledges AS (
            SELECT
                pledges.by_user_id AS user_id,
                pledges.id AS event_id,
                pledges.created_at AS event_created_at,
                RANK() OVER (PARTITION BY pledges.by_user_id ORDER BY pledges.created_at ASC) AS event_rank,
                'pledge' AS event_type
            FROM pledges
            WHERE pledges.by_user_id IS NOT NULL
        ), user_donations AS (
            SELECT
                donations.by_user_id AS user_id,
                donations.id AS event_id,
                donations.created_at AS event_created_at,
                RANK() OVER (PARTITION BY donations.by_user_id ORDER BY donations.created_at ASC) AS event_rank,
                'donation' AS event_type
            FROM donations
            WHERE donations.by_user_id IS NOT NULL
        ), user_purchases AS (
            SELECT
                orders.user_id AS user_id,
                orders.id AS event_id,
                orders.created_at AS event_created_at,
                RANK() OVER (PARTITION BY orders.user_id ORDER BY orders.created_at ASC) AS event_rank,
                'purchase' AS event_type
            FROM orders
            WHERE 1 = 1
                AND orders.user_id IS NOT NULL
                AND orders.subscription_id IS NULL
        ), user_subscriptions AS (
            SELECT
                subscriptions.user_id AS user_id,
                subscriptions.id AS event_id,
                subscriptions.created_at AS event_created_at,
                RANK() OVER (PARTITION BY subscriptions.user_id ORDER BY subscriptions.created_at ASC) AS event_rank,
                'subscription' AS event_type
            FROM subscriptions
            WHERE 1 = 1
                AND subscriptions.user_id IS NOT NULL
                AND subscriptions.stripe_subscription_id IS NOT NULL
        ), user_newsletter_subscriptions AS (
            SELECT
                subscriptions.user_id AS user_id,
                subscriptions.id AS event_id,
                subscriptions.created_at AS event_created_at,
                RANK() OVER (PARTITION BY subscriptions.user_id ORDER BY subscriptions.created_at ASC) AS event_rank,
                'newsletter_subscription' AS event_type
            FROM subscriptions
            WHERE 1 = 1
                AND subscriptions.user_id IS NOT NULL
                AND subscriptions.stripe_subscription_id IS NULL
                -- Exclude historic Polar Newsletter subscription (created first on new signups)
                AND subscriptions.product_id != 'd3d1a7ed-f045-43e3-8365-4c216a1b9949'
        ), user_creators AS (
            SELECT
                uo.user_id AS user_id,
                uo.organization_id AS event_id,
                uo.created_at AS event_created_at,
                RANK() OVER (PARTITION BY uo.user_id ORDER BY uo.created_at ASC) AS event_rank,
                'creator' AS event_type
            FROM user_organizations AS uo
        ), user_events AS (
            SELECT * FROM user_pledges
            UNION SELECT * FROM user_donations
            UNION SELECT * FROM user_purchases
            UNION SELECT * FROM user_subscriptions
            UNION SELECT * FROM user_newsletter_subscriptions
            UNION SELECT * FROM user_creators
        ), attribution_rank AS (
            SELECT
                ue.*,
                users.email,
                users.created_at,
                RANK() OVER (PARTITION BY ue.user_id ORDER BY event_created_at ASC) AS rank
            FROM user_events AS ue
            JOIN users ON users.id = ue.user_id
        ), attributions AS (
            SELECT
                *,
                CASE
                    WHEN event_type = 'pledge' THEN json_build_object('intent', 'pledge', 'pledge', event_id)
                    WHEN event_type = 'donation' THEN json_build_object('intent', 'donation', 'donation', event_id)
                    WHEN event_type = 'purchase' THEN json_build_object('intent', 'purchase', 'order', event_id)
                    WHEN event_type = 'subscription' THEN json_build_object('intent', 'subscription', 'subscription', event_id)
                    WHEN event_type = 'newsletter_subscription' THEN json_build_object('intent', 'newsletter_subscription', 'subscription', event_id)
                    WHEN event_type = 'creator' THEN json_build_object('intent', 'creator')
                    ELSE NULL
                END AS signup_attribution
            FROM attribution_rank WHERE rank = 1
        )
        UPDATE users
        SET meta = json_build_object('signup', attributions.signup_attribution)
        FROM attributions
        WHERE 1 = 1
            AND attributions.signup_attribution IS NOT NULL
            AND users.id = attributions.user_id
        """
    )


def downgrade() -> None:
    # Noop since we had incomplete attribution before. Would be like swapping a
    # broken state to another broken state.
    pass
