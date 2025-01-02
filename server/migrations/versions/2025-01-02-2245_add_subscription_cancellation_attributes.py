"""add subscription cancellation attributes

Revision ID: 81faf775fce0
Revises: 58d5e316549f
Create Date: 2025-01-02 22:45:35.324752

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "81faf775fce0"
down_revision = "58d5e316549f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("canceled_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("ends_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("customer_cancellation_reason", sa.String(), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("customer_cancellation_comment", sa.Text(), nullable=True),
    )
    op.execute(
        """
        WITH data AS (
            SELECT
                subs.id AS subscription_id,
                subs.modified_at,
                CASE
                    WHEN subs.ended_at IS NOT NULL THEN subs.ended_at
                    WHEN subs.cancel_at_period_end = 'true' AND subs.current_period_end IS NOT NULL THEN subs.current_period_end
                    ELSE NULL
                END AS ends_at
            FROM subscriptions AS subs
            WHERE 1 = 1
                AND (
                    subs.cancel_at_period_end = 'true'
                    OR subs.ended_at IS NOT NULL
                )
        ), cancellations AS (
            SELECT
                data.*,
                -- Prefer to avoid legacy NULL values for cancellations so we
                -- try to perform our best guess here OR set it to `ends_at`.
                -- Can separately write a script to pull from Stripe and update
                -- legacy data if necessary.
                CASE
                    WHEN data.modified_at < data.ends_at THEN data.modified_at
                    ELSE data.ends_at
                END AS canceled_at
            FROM data
        )
        UPDATE subscriptions
        SET
            ends_at = cancellations.ends_at,
            canceled_at = cancellations.canceled_at
        FROM cancellations
        WHERE 1 = 1
            AND subscriptions.id = cancellations.subscription_id
            AND cancellations.ends_at IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("subscriptions", "ends_at")
    op.drop_column("subscriptions", "canceled_at")
    op.drop_column("subscriptions", "customer_cancellation_comment")
    op.drop_column("subscriptions", "customer_cancellation_reason")
