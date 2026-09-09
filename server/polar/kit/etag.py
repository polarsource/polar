import functools
import hashlib
from typing import Annotated, Any

from fastapi import Header
from pydantic import TypeAdapter

from polar.exceptions import PreconditionFailed

PreconditionFailedResponse = {
    "description": (
        "The `If-Match` header doesn't match the current `ETag` of the resource: "
        "it has been modified since it was last retrieved."
    ),
    "model": PreconditionFailed.schema(),
}

IF_MATCH_DESCRIPTION = (
    "Only apply the change if the resource's current `ETag` matches one of the "
    "given entity tags, as returned by a previous response. "
    "Use `*` to match any tag. A mismatch yields a `412 Precondition Failed` error."
)


@functools.cache
def _get_type_adapter(schema: Any) -> TypeAdapter[Any]:
    return TypeAdapter(schema)


def compute_etag(resource: Any, schema: Any) -> str:
    """
    Compute a strong entity tag for `resource`, hashing its JSON representation
    as serialized by `schema`.

    The tag depends on the active API version, since the serialized representation
    does too, and changes whenever any field of the representation changes,
    including nested objects.
    """
    adapter = _get_type_adapter(schema)
    representation = adapter.validate_python(resource, from_attributes=True)
    payload = adapter.dump_json(representation, by_alias=True)
    return f'"{hashlib.sha256(payload).hexdigest()}"'


class Precondition:
    """
    Result of the `IfMatch` dependency, carrying the `If-Match` header value
    of the request.

    Call `check` with the resource loaded for a mutation, before mutating it,
    to enforce the precondition.
    """

    def __init__(self, schema: Any, if_match: str | None) -> None:
        self.schema = schema
        self.if_match = if_match

    def check(self, resource: Any) -> None:
        if self.if_match is None:
            return

        entity_tags = [tag.strip() for tag in self.if_match.split(",")]
        if "*" in entity_tags:
            return

        # Per RFC 9110, If-Match uses the strong comparison: weak tags never match.
        if compute_etag(resource, self.schema) not in entity_tags:
            raise PreconditionFailed()


class IfMatch:
    """
    Dependency reading the `If-Match` header of the request.

    `schema` is the response schema of the resource, used to compute its
    `ETag` for comparison. It must be the same schema used by the endpoints
    returning the resource, so the tags match.
    """

    def __init__(self, schema: Any) -> None:
        self.schema = schema

    async def __call__(
        self,
        if_match: Annotated[
            str | None, Header(description=IF_MATCH_DESCRIPTION)
        ] = None,
    ) -> Precondition:
        return Precondition(self.schema, if_match)
