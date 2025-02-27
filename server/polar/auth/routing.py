import inspect
import typing
from collections.abc import Callable

from fastapi.params import Depends
from fastapi.routing import APIRoute

from polar.auth.dependencies import _Authenticator
from polar.auth.scope import RESERVED_SCOPES


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

                dependency = metadata[0].dependency
                if not isinstance(dependency, _Authenticator):
                    continue

                allowed_subjects = dependency.allowed_subjects
                required_scopes = dependency.required_scopes

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
                scopes_list = [
                    f"`{s}`"
                    for s in sorted(required_scopes or [])
                    if s not in RESERVED_SCOPES
                ]
                if scopes_list:
                    description += f"\n\n**Scopes**: {' '.join(scopes_list)}"
                kwargs["description"] = description

                break

        super().__init__(path, endpoint, **kwargs)


__all__ = ["DocumentedAuthSubjectAPIRoute"]
