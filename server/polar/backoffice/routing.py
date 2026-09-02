from polar.kit.routing import TransactionalAPIRoute, get_api_router_class

BackofficeRouter = get_api_router_class(TransactionalAPIRoute)

__all__ = ["BackofficeRouter"]
