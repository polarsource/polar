import structlog
from sqlalchemy.orm import InstrumentedAttribute

from polar.actions.base import Action
from polar.models import Repository
from polar.schema.repository import RepositoryCreate, RepositoryUpdate

log = structlog.get_logger()


class RepositoryActions(Action[Repository, RepositoryCreate, RepositoryUpdate]):
    @property
    def upsert_constraints(self) -> list[InstrumentedAttribute[int]]:
        return [self.model.external_id]


repository = RepositoryActions(Repository)
