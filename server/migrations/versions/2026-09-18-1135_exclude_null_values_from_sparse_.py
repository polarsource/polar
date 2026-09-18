"""exclude null values from sparse transaction indexes

Revision ID: 8428f6d6cb5d
Revises: 029b7898d665
Create Date: 2026-09-18 11:35:23.397825

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "8428f6d6cb5d"
down_revision = "029b7898d665"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


COLUMNS = (
    "charge_id",
    "customer_id",
    "dispute_id",
    "fee_balance_transaction_id",
    "issue_reward_id",
    "payment_customer_id",
    "payment_organization_id",
    "payment_user_id",
    "payout_id",
    "pledge_id",
    "processor_fee_type",
    "refund_id",
    "tax_country",
)


def replace_indexes(*, partial: bool) -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for column in COLUMNS:
                full_name = f"ix_transactions_{column}"
                partial_name = f"{full_name}_not_null"
                new_name, old_name = (
                    (partial_name, full_name) if partial else (full_name, partial_name)
                )
                valid = op.get_bind().scalar(
                    sa.text(
                        "SELECT indisvalid FROM pg_index "
                        "WHERE indexrelid = to_regclass(:name)"
                    ),
                    {"name": new_name},
                )
                # Preserve completed replacements and recover interrupted builds.
                if valid is False:
                    op.drop_index(
                        new_name,
                        table_name="transactions",
                        postgresql_concurrently=True,
                    )
                if not valid:
                    op.create_index(
                        new_name,
                        "transactions",
                        [column],
                        postgresql_where=sa.text(f"{column} IS NOT NULL")
                        if partial
                        else None,
                        postgresql_concurrently=True,
                    )
                op.drop_index(
                    old_name,
                    table_name="transactions",
                    if_exists=True,
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")


def upgrade() -> None:
    replace_indexes(partial=True)


def downgrade() -> None:
    replace_indexes(partial=False)
