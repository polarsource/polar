from datetime import datetime
from typing import Self
from uuid import UUID

from polar.kit.schemas import Schema
from polar.models import Milestone as MilestoneModel


# Public API
class Milestone(Schema):
    id: UUID
    title: str
    description: str
    deadline_at: datetime | None

    @classmethod
    def from_db(cls, o: MilestoneModel) -> Self:
        return cls(
            id=o.id,
            title=o.title,
            description=o.description,
            deadline_at=o.deadline_at,
        )
