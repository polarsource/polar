"""Add Mercury payout infrastructure.

Revision ID: 2026012814001
Revises: 5c9d3e4f6a7b
Create Date: 2026-01-28 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "2026012814001"
down_revision = "5c9d3e4f6a7b"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Create account_bank_details table for storing verified bank information
    op.create_table(
        "account_bank_details",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "account_id",
            sa.Uuid(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # Encrypted bank details (use application-level encryption)
        sa.Column("routing_number_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("account_number_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("account_number_last4", sa.String(4), nullable=False),
        sa.Column(
            "account_type",
            sa.String(20),
            nullable=False,
            comment="checking or savings",
        ),
        sa.Column("bank_name", sa.String(255), nullable=True),
        # Verification metadata
        sa.Column(
            "verification_method",
            sa.String(50),
            nullable=False,
            comment="stripe_financial_connections, plaid, or manual",
        ),
        sa.Column("verified_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column(
            "stripe_financial_connection_id",
            sa.String(100),
            nullable=True,
            comment="Stripe Financial Connections account ID",
        ),
        # Mercury recipient tracking
        sa.Column(
            "mercury_recipient_id",
            sa.String(100),
            nullable=True,
            index=True,
            comment="Mercury API recipient ID",
        ),
        sa.Column("mercury_recipient_created_at", sa.TIMESTAMP(timezone=True), nullable=True),
        # Standard timestamps
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    # Add unique constraint - one active bank detail per account
    op.create_index(
        "ix_account_bank_details_account_id_active",
        "account_bank_details",
        ["account_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # Add payout provider preference to accounts
    op.add_column(
        "accounts",
        sa.Column(
            "payout_provider",
            sa.String(20),
            nullable=False,
            server_default="stripe",
            comment="stripe or mercury",
        ),
    )

    # Add Mercury-specific fields to payouts table
    op.add_column(
        "payouts",
        sa.Column(
            "payout_method",
            sa.String(20),
            nullable=True,
            comment="ach, same_day_ach, rtp, or wire",
        ),
    )
    op.add_column(
        "payouts",
        sa.Column(
            "mercury_transaction_id",
            sa.String(100),
            nullable=True,
            index=True,
        ),
    )
    op.add_column(
        "payouts",
        sa.Column(
            "failure_reason",
            sa.String(255),
            nullable=True,
            comment="ACH return code and description if failed",
        ),
    )
    op.add_column(
        "payouts",
        sa.Column(
            "estimated_arrival_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )

    # Add PayoutStatus.failed and PayoutStatus.returned
    # Note: Enum modification handled by application code


def downgrade() -> None:
    op.drop_column("payouts", "estimated_arrival_at")
    op.drop_column("payouts", "failure_reason")
    op.drop_column("payouts", "mercury_transaction_id")
    op.drop_column("payouts", "payout_method")
    op.drop_column("accounts", "payout_provider")
    op.drop_index("ix_account_bank_details_account_id_active")
    op.drop_table("account_bank_details")
