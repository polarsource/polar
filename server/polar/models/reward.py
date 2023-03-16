from uuid import UUID
from decimal import Decimal

from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID


class Reward(RecordModel):
    __tablename__ = "rewards"

    issue_id: Mapped[UUID] = mapped_column(PostgresUUID, nullable=False)
    repository_id: Mapped[UUID] = mapped_column(PostgresUUID, nullable=False)
    organization_id: Mapped[UUID] = mapped_column(PostgresUUID, nullable=False)
    payment_id: Mapped[str] = mapped_column(String, nullable=True, index=True)

    email: Mapped[str] = mapped_column(String, nullable=False, index=True)

    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=25, scale=10), nullable=False
    )

    state: Mapped[str] = mapped_column(String, nullable=False, default="initiated")

    # TODO: Add stripe fields here to support anonymous customers?
