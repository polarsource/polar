import types
import typing
from collections.abc import Callable

from fastapi.routing import APIRoute

from polar.auth.models import AuthSubject


class DocumentedAuthSubjectAPIRoute(APIRoute):
    """
    A subclass of `APIRoute` that automatically
    documents the allowed subjects for the endpoint.
    """

    def __init__(
        self, path: str, endpoint: Callable[..., typing.Any], **kwargs: typing.Any
    ) -> None:
        for param in typing.get_type_hints(endpoint).values():
            if typing.get_origin(param) is AuthSubject:
                allowed_subjects_type = typing.get_args(param)[0]
                if typing.get_origin(allowed_subjects_type) is types.UnionType:
                    allowed_subjects = set(typing.get_args(allowed_subjects_type))
                else:
                    allowed_subjects = {allowed_subjects_type}
                allowed_subjects_names = sorted(
                    [allowed_subject.__name__ for allowed_subject in allowed_subjects]
                )
                openapi_extra = kwargs.get("openapi_extra") or {}
                kwargs["openapi_extra"] = {
                    "x-polar-allowed-subjects": allowed_subjects_names,
                    **openapi_extra,
                }
        super().__init__(path, endpoint, **kwargs)


__all__ = ["DocumentedAuthSubjectAPIRoute"]
