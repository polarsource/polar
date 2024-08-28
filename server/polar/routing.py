from polar.auth.routing import DocumentedAuthSubjectAPIRoute
from polar.kit.routing import (
    AutoCommitAPIRoute,
    SpeakeasyGroupAPIRoute,
    SpeakeasyIgnoreAPIRoute,
    SpeakeasyPaginationAPIRoute,
    get_api_router_class,
)


class APIRoute(
    AutoCommitAPIRoute,
    DocumentedAuthSubjectAPIRoute,
    SpeakeasyIgnoreAPIRoute,
    SpeakeasyGroupAPIRoute,
    SpeakeasyPaginationAPIRoute,
):
    pass


APIRouter = get_api_router_class(APIRoute)

__all__ = ["APIRouter"]
