"""Add missing payment transaction fees

Revision ID: 147a781fd5f3
Revises: 6fdd959d5dbe
Create Date: 2025-07-15 15:18:32.624229

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "147a781fd5f3"
down_revision = "6fdd959d5dbe"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO transactions (
           	id,
           	created_at,
           	type,
           	processor,
           	currency,
           	amount,
           	account_currency,
           	account_amount,
           	tax_amount,
           	processor_fee_type,
           	incurred_by_transaction_id
        )
        WITH no_fee_payments AS (
           	SELECT t1.id AS id, t1.charge_id AS charge_id, t1.created_at AS created_at
           	FROM transactions t1
           	LEFT JOIN transactions t2 ON t2.incurred_by_transaction_id = t1.id
           	WHERE t1.type = 'payment' AND t2.id IS NULL
        )
        SELECT
           	uuid_generate_v4(),
           	no_fee_payments.created_at,
           	'processor_fee',
           	'stripe',
           	'usd',
           	-pt.fee,
           	'usd',
           	-pt.fee,
           	0,
           	'payment',
           	no_fee_payments.id
        FROM processor_transactions AS pt
        JOIN no_fee_payments ON no_fee_payments.charge_id = pt.raw->>'source';
        """
    )


def downgrade() -> None:
    pass
