from polar.kit.repository import RepositoryBase, RepositorySoftDeletionMixin
from polar.models import Feedback


class FeedbackRepository(
    RepositorySoftDeletionMixin[Feedback],
    RepositoryBase[Feedback],
):
    model = Feedback
