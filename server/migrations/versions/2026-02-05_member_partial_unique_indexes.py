"""Replace member unique constraints with partial unique indexes for soft-delete

This migration replaces the unique constraints on members table with partial
unique indexes that only apply to non-deleted rows. This allows soft-deleted
members to exist without blocking the creation of new members with the same
(customer_id, email) or (customer_id, external_id) combination.

Fixes: IntegrityError when assigning a seat to an email that belongs to a
soft-deleted member.

Revision ID: c5e9f3b2d4a6
Revises: b4d8f2a1c3e5
Create Date: 2026-02-05 10:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "c5e9f3b2d4a6"
down_revision = "b4d8f2a1c3e5"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # First, create the new partial unique indexes concurrently
    # This avoids blocking reads/writes on large tables
    with op.get_context().autocommit_block():
        op.create_index(
            "members_customer_id_email_active_key",
            "members",
            ["customer_id", "email"],
            unique=True,
            postgresql_where="deleted_at IS NULL",
            postgresql_concurrently=True,
        )
        op.create_index(
            "members_customer_id_external_id_active_key",
            "members",
            ["customer_id", "external_id"],
            unique=True,
            postgresql_where="deleted_at IS NULL AND external_id IS NOT NULL",
            postgresql_concurrently=True,
        )

    # Now drop the old unique constraints
    op.drop_constraint(
        "members_customer_id_email_key", "members", type_="unique"
    )
    op.drop_constraint(
        "members_customer_id_external_id_key", "members", type_="unique"
    )


def downgrade() -> None:
    # Re-create the original unique constraints
    # Note: This will fail if there are soft-deleted duplicates
    op.create_unique_constraint(
        "members_customer_id_email_key",
        "members",
        ["customer_id", "email"],
        postgresql_nulls_not_distinct=True,
    )
    op.create_unique_constraint(
        "members_customer_id_external_id_key",
        "members",
        ["customer_id", "external_id"],
        postgresql_nulls_not_distinct=False,
    )

    # Drop the partial indexes
    with op.get_context().autocommit_block():
        op.drop_index(
            "members_customer_id_external_id_active_key",
            table_name="members",
            postgresql_concurrently=True,
        )
        op.drop_index(
            "members_customer_id_email_active_key",
            table_name="members",
            postgresql_concurrently=True,
        )
