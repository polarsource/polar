"""add manual benefit grant timestamps

Revision ID: 0f274f97b87c
Revises: d62a0b8e4c75
Create Date: 2026-11-12 14:05:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "0f274f97b87c"
down_revision = "d62a0b8e4c75"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

TABLE = "benefit_grants"
MANUAL_SCOPE_CHECK = "benefit_grants_manual_scope_check"
LEGACY_INDEX = "ix_benefit_grants_scope_unique"
NON_MANUAL_INDEX = "ix_benefit_grants_non_manual_scope_unique"
ACTIVE_MANUAL_INDEX = "ix_benefit_grants_active_manual_unique"
SCOPE_COLUMNS = [
    "customer_id",
    "benefit_id",
    "member_id",
    "subscription_id",
    "order_id",
]


def _drop_index(name: str) -> None:
    op.drop_index(name, table_name=TABLE, if_exists=True, postgresql_concurrently=True)


def _create_index(name: str, columns: list[str], predicate: str) -> None:
    valid = op.get_bind().scalar(
        sa.text(
            "SELECT indisvalid FROM pg_index WHERE indexrelid = to_regclass(:name)"
        ),
        {"name": name},
    )
    if valid:
        return
    if valid is False:
        _drop_index(name)
    try:
        op.create_index(
            name,
            TABLE,
            columns,
            unique=True,
            postgresql_concurrently=True,
            postgresql_nulls_not_distinct=True,
            postgresql_where=sa.text(predicate),
        )
    except sa.exc.IntegrityError:
        _drop_index(name)
        raise


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        TABLE,
        sa.Column("manually_granted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        if_not_exists=True,
    )
    op.add_column(
        TABLE,
        sa.Column("manually_revoked_at", sa.TIMESTAMP(timezone=True), nullable=True),
        if_not_exists=True,
    )
    op.drop_constraint(op.f(MANUAL_SCOPE_CHECK), TABLE, type_="check", if_exists=True)
    op.create_check_constraint(
        op.f(MANUAL_SCOPE_CHECK),
        TABLE,
        "manually_granted_at IS NULL OR (order_id IS NULL AND subscription_id IS NULL)",
        postgresql_not_valid=True,
    )

    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            _create_index(
                NON_MANUAL_INDEX,
                SCOPE_COLUMNS,
                "deleted_at IS NULL AND manually_granted_at IS NULL",
            )
            _create_index(
                ACTIVE_MANUAL_INDEX,
                ["customer_id", "member_id", "benefit_id"],
                "deleted_at IS NULL AND manually_granted_at IS NOT NULL "
                "AND manually_revoked_at IS NULL",
            )
            _drop_index(LEGACY_INDEX)
        finally:
            op.execute("RESET lock_timeout")

    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(f"ALTER TABLE {TABLE} VALIDATE CONSTRAINT {MANUAL_SCOPE_CHECK}")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            _create_index(LEGACY_INDEX, SCOPE_COLUMNS, "deleted_at IS NULL")
            _drop_index(ACTIVE_MANUAL_INDEX)
            _drop_index(NON_MANUAL_INDEX)
        finally:
            op.execute("RESET lock_timeout")

    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(op.f(MANUAL_SCOPE_CHECK), TABLE, type_="check")
    op.drop_column(TABLE, "manually_revoked_at")
    op.drop_column(TABLE, "manually_granted_at")
