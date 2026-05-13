import inspect
import typing
from collections.abc import Callable

from fastapi.params import Depends
from fastapi.routing import APIRoute

from polar.auth.dependencies import _Authenticator


def _find_authenticator(dependency: typing.Any) -> _Authenticator | None:
    """Locate an ``_Authenticator`` in a dependency tree.

    Direct ``_Authenticator`` instances are returned as-is. For callables
    that wrap an authenticator (e.g. ``OrgPolicyGuard``'s inner
    ``dependency`` function, which takes ``Annotated[..., Depends(_authenticator)]``
    as one of its own parameters), we recurse one level into the callable's
    own type hints to find it.
    """
    if isinstance(dependency, _Authenticator):
        return dependency
    if dependency is None:
        return None
    try:
        hints = typing.get_type_hints(dependency, include_extras=True)
    except Exception:
        return None
    for hint in hints.values():
        if typing.get_origin(hint) is not typing.Annotated:
            continue
        for meta in hint.__metadata__:
            if not isinstance(meta, Depends):
                continue
            if isinstance(meta.dependency, _Authenticator):
                return meta.dependency
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
        # Check we haven't already added the allowed subjects
        if "x-polar-allowed-subjects" not in openapi_extra:
            for param in typing.get_type_hints(endpoint, include_extras=True).values():
                if typing.get_origin(param) is not typing.Annotated:
                    continue

                metadata = param.__metadata__
                if len(metadata) == 0 or not isinstance(metadata[0], Depends):
                    continue

                authenticator = _find_authenticator(metadata[0].dependency)
                if authenticator is None:
                    continue

                allowed_subjects = authenticator.allowed_subjects
                required_scopes = authenticator.required_scopes

                allowed_subjects_names = sorted(
                    [allowed_subject.__name__ for allowed_subject in allowed_subjects]
                )

                kwargs["openapi_extra"] = {
                    "x-polar-allowed-subjects": allowed_subjects_names,
                    **openapi_extra,
                }

                description = kwargs["description"] or inspect.cleandoc(
                    endpoint.__doc__ or ""
                )
                scopes_list = [f"`{s}`" for s in sorted(required_scopes or [])]
                if scopes_list:
                    description += f"\n\n**Scopes**: {' '.join(scopes_list)}"
                kwargs["description"] = description

                break

        super().__init__(path, endpoint, **kwargs)


__all__ = ["DocumentedAuthSubjectAPIRoute"]
