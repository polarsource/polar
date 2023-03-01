from sqlalchemy import Numeric
from sqlalchemy.orm import Mapped, mapped_column

from polar.ext.sqlalchemy.types import GUID
from polar.models.base import RecordModel


class Reward(RecordModel):
    __tablename__ = "rewards"

    issue_id: Mapped[GUID] = mapped_column(GUID, nullable=False)
    repository_id: Mapped[GUID] = mapped_column(GUID, nullable=False)
    organization_id: Mapped[GUID] = mapped_column(GUID, nullable=False)

    amount: Mapped[Numeric] = mapped_column(
        Numeric(precision=25, scale=10), nullable=False
    )
