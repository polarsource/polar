from datetime import datetime

from sqlalchemy import TIMESTAMP, String
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import Model


class ScheduledCron(Model):
    __tablename__ = "scheduled_crons"

    job_name: Mapped[str] = mapped_column(String, primary_key=True)
    trigger: Mapped[str] = mapped_column(String, nullable=False)
    next_run_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
