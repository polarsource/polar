"""create pledge transactions

Revision ID: 5260355de70c
Revises: 925c9f34054d
Create Date: 2023-04-26 13:27:44.461304

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5260355de70c"
down_revision = "925c9f34054d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pledge_transactions",
        sa.Column("pledge_id", sa.UUID(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("transaction_id", sa.String(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["pledge_id"],
            ["pledges.id"],
            name=op.f("pledge_transactions_pledge_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pledge_transactions_pkey")),
    )

    # We pledged the pledge amount at the creation time of the pledge (the time
    # is not entirely, but almost, correct). We don't have the transaction_id
    # in the db unfortunately.
    op.execute(
        """INSERT INTO pledge_transactions
      (pledge_id, type, amount, transaction_id, id, created_at)
      SELECT id, 'pledge', amount, null, gen_random_uuid(), created_at
        FROM pledges WHERE state != 'initiated'"""
    )

    # We transfered 85% of the pledge amount at the modified time of the pledge (I guess
    # it could be modified multiple times, but it's close enough)
    op.execute(
        """INSERT INTO pledge_transactions
      (pledge_id, type, amount, transaction_id, id, created_at)
      SELECT id, 'transfer', amount * 0.85, transfer_id, gen_random_uuid(), modified_at
        FROM pledges WHERE state != 'initiated' AND state != 'created'"""
    )


def downgrade() -> None:
    op.drop_table("pledge_transactions")
