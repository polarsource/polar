from sqlalchemy import Unicode
from sqlalchemy.orm import Mapped, mapped_column

from polar.models.base import RecordModel


class Demo(RecordModel):
    __tablename__ = "demo"
    testing: Mapped[str] = mapped_column(
        Unicode(255), nullable=False, default="testing"
    )
