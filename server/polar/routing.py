from polar.auth.routing import DocumentedAuthSubjectAPIRoute
from polar.kit.routing import (
    AutoCommitAPIRoute,
    IncludedInSchemaAPIRoute,
    SpeakeasyGroupAPIRoute,
    SpeakeasyIgnoreAPIRoute,
    SpeakeasyNameOverrideAPIRoute,
    SpeakeasyPaginationAPIRoute,
    get_api_router_class,
)


class APIRoute(
    AutoCommitAPIRoute,
    IncludedInSchemaAPIRoute,
    DocumentedAuthSubjectAPIRoute,
    SpeakeasyIgnoreAPIRoute,
    SpeakeasyNameOverrideAPIRoute,
    SpeakeasyGroupAPIRoute,
    SpeakeasyPaginationAPIRoute,
):
    pass


APIRouter = get_api_router_class(APIRoute)

__all__ = ["APIRouter"]
