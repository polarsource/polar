import inspect
import typing
from collections.abc import Callable

from fastapi.params import Depends
from fastapi.routing import APIRoute

from polar.auth.dependencies import _Authenticator


def _find_authenticator(
    callable_: Callable[..., typing.Any],
    seen: set[int] | None = None,
) -> _Authenticator | None:
    """Walk a callable's annotated dependencies to find a nested _Authenticator.

    The endpoint may declare ``Depends(_Authenticator)`` directly, or wrap it
    behind one or more module-level dependency functions (the policy-guard
    pattern). We recurse until we find the underlying _Authenticator so the
    OpenAPI annotations (allowed subjects, required scopes) are surfaced
    regardless of how the dependency tree is structured.
    """
    seen = seen if seen is not None else set()
    if id(callable_) in seen:
        return None
    seen.add(id(callable_))

    try:
        hints = typing.get_type_hints(callable_, include_extras=True)
    except (NameError, TypeError):
        return None

    for param in hints.values():
        if typing.get_origin(param) is not typing.Annotated:
            continue

        metadata = param.__metadata__
        if len(metadata) == 0 or not isinstance(metadata[0], Depends):
            continue

        dependency = metadata[0].dependency
        if isinstance(dependency, _Authenticator):
            return dependency

        if dependency is not None:
            nested = _find_authenticator(dependency, seen)
            if nested is not None:
                return nested

    return None


class DocumentedAuthSubjectAPIRoute(APIRoute):
    """
    A subclass of `APIRoute` that automatically
    documents the allowed subjects and scopes for the endpoint.
    """

    def __init__(
        self, path: str, endpoint: Callable[..., typing.Any], **kwargs: typing.Any
    ) -> None:
        openapi_extra = kwargs.get("openapi_extra") or {}
        if "x-polar-allowed-subjects" not in openapi_extra:
            authenticator = _find_authenticator(endpoint)
            if authenticator is not None:
                allowed_subjects_names = sorted(
                    [s.__name__ for s in authenticator.allowed_subjects]
                )

                kwargs["openapi_extra"] = {
                    "x-polar-allowed-subjects": allowed_subjects_names,
                    **openapi_extra,
                }

                description = kwargs["description"] or inspect.cleandoc(
                    endpoint.__doc__ or ""
                )
                scopes_list = [
                    f"`{s}`" for s in sorted(authenticator.required_scopes or [])
                ]
                if scopes_list:
                    description += f"\n\n**Scopes**: {' '.join(scopes_list)}"
                kwargs["description"] = description

        super().__init__(path, endpoint, **kwargs)


__all__ = ["DocumentedAuthSubjectAPIRoute"]
