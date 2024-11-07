"""Remove donation

Revision ID: ec0834c42223
Revises: 6de0c2b1262f
Create Date: 2024-11-07 15:02:24.626991

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "ec0834c42223"
down_revision = "6de0c2b1262f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_donations_by_organization_id", table_name="donations")
    op.drop_index("ix_donations_by_user_id", table_name="donations")
    op.drop_index("ix_donations_charge_id", table_name="donations")
    op.drop_index("ix_donations_created_at", table_name="donations")
    op.drop_index("ix_donations_deleted_at", table_name="donations")
    op.drop_index("ix_donations_email", table_name="donations")
    op.drop_index("ix_donations_modified_at", table_name="donations")
    op.drop_index("ix_donations_on_behalf_of_organization_id", table_name="donations")
    op.drop_index("ix_donations_payment_id", table_name="donations")
    op.drop_index("ix_held_balances_donation_id", table_name="held_balances")
    op.drop_constraint(
        "held_balances_donation_id_fkey", "held_balances", type_="foreignkey"
    )
    op.drop_column("held_balances", "donation_id")
    op.drop_column("organizations", "donations_enabled")

    op.drop_index("ix_transactions_donation_id", table_name="transactions")
    op.drop_constraint(
        "transactions_donation_id_fkey", "transactions", type_="foreignkey"
    )
    op.drop_column("transactions", "donation_id")

    op.drop_table("donations")


def downgrade() -> None:
    op.create_table(
        "donations",
        sa.Column("to_organization_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("payment_id", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("email", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("amount", sa.BIGINT(), autoincrement=False, nullable=False),
        sa.Column("amount_received", sa.BIGINT(), autoincrement=False, nullable=False),
        sa.Column("by_user_id", sa.UUID(), autoincrement=False, nullable=True),
        sa.Column("by_organization_id", sa.UUID(), autoincrement=False, nullable=True),
        sa.Column(
            "on_behalf_of_organization_id",
            sa.UUID(),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column("created_by_user_id", sa.UUID(), autoincrement=False, nullable=True),
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "deleted_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column("charge_id", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("message", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("issue_id", sa.UUID(), autoincrement=False, nullable=True),
        sa.Column(
            "currency", sa.VARCHAR(length=3), autoincrement=False, nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["by_organization_id"],
            ["organizations.id"],
            name="donations_by_organization_id_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["by_user_id"], ["users.id"], name="donations_by_user_id_fkey"
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            name="donations_created_by_user_id_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["issue_id"], ["issues.id"], name="donations_issue_id_fkey"
        ),
        sa.ForeignKeyConstraint(
            ["on_behalf_of_organization_id"],
            ["organizations.id"],
            name="donations_on_behalf_of_organization_id_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["to_organization_id"],
            ["organizations.id"],
            name="donations_to_organization_id_fkey",
        ),
        sa.PrimaryKeyConstraint("id", name="donations_pkey"),
    )
    op.create_index(
        "ix_donations_payment_id", "donations", ["payment_id"], unique=False
    )
    op.create_index(
        "ix_donations_on_behalf_of_organization_id",
        "donations",
        ["on_behalf_of_organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_donations_modified_at", "donations", ["modified_at"], unique=False
    )
    op.create_index("ix_donations_email", "donations", ["email"], unique=False)
    op.create_index(
        "ix_donations_deleted_at", "donations", ["deleted_at"], unique=False
    )
    op.create_index(
        "ix_donations_created_at", "donations", ["created_at"], unique=False
    )
    op.create_index("ix_donations_charge_id", "donations", ["charge_id"], unique=False)
    op.create_index(
        "ix_donations_by_user_id", "donations", ["by_user_id"], unique=False
    )
    op.create_index(
        "ix_donations_by_organization_id",
        "donations",
        ["by_organization_id"],
        unique=False,
    )

    op.add_column(
        "transactions",
        sa.Column("donation_id", sa.UUID(), autoincrement=False, nullable=True),
    )
    op.create_foreign_key(
        "transactions_donation_id_fkey",
        "transactions",
        "donations",
        ["donation_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_transactions_donation_id", "transactions", ["donation_id"], unique=False
    )
    op.drop_column("products", "user_metadata")
    op.add_column(
        "organizations",
        sa.Column(
            "donations_enabled", sa.BOOLEAN(), autoincrement=False, nullable=True
        ),
    )
    op.execute("UPDATE organizations SET donations_enabled = FALSE")
    op.alter_column("organizations", "donations_enabled", nullable=False)

    op.add_column(
        "held_balances",
        sa.Column("donation_id", sa.UUID(), autoincrement=False, nullable=True),
    )
    op.create_foreign_key(
        "held_balances_donation_id_fkey",
        "held_balances",
        "donations",
        ["donation_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_held_balances_donation_id", "held_balances", ["donation_id"], unique=False
    )
