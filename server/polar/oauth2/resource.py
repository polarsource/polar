"""Resource Indicators for OAuth 2.0, RFC 8707.

https://datatracker.ietf.org/doc/html/rfc8707
"""

from urllib.parse import urlsplit

from authlib.oauth2.rfc6749 import OAuth2Payload

from .exceptions import InvalidTargetError


def get_requested_resource(payload: OAuth2Payload) -> str | None:
    values = payload.datalist.get("resource", [])
    if not values:
        return None
    if len(values) > 1:
        raise InvalidTargetError("Only one 'resource' parameter is supported.")

    resource = values[0]
    if not urlsplit(resource).scheme or "#" in resource:
        raise InvalidTargetError(
            "The 'resource' parameter must be an absolute URI without a fragment."
        )
    return resource


def resolve_token_resource(granted: str | None, payload: OAuth2Payload) -> str | None:
    """The resource to bind a token to, from its grant and the token request.

    A token request may narrow an unbound grant to a resource, but never move a
    bound grant to another one.
    """
    requested = get_requested_resource(payload)
    if requested is None:
        return granted
    if granted is not None and requested != granted:
        raise InvalidTargetError(
            "The 'resource' parameter does not match the authorization grant."
        )
    return requested
