import dataclasses

import pytest
from pydantic import BaseModel

from polar.exceptions import PreconditionFailed
from polar.kit.etag import IfMatch, Precondition, compute_etag


class ThingSchema(BaseModel):
    name: str
    count: int


class ThingSchemaNameOnly(BaseModel):
    name: str


@dataclasses.dataclass
class Thing:
    name: str
    count: int
    internal: str = "ignored"


class TestComputeETag:
    def test_strong_tag_stable_across_calls(self) -> None:
        etag = compute_etag(Thing("a", 1), ThingSchema)

        assert etag.startswith('"')
        assert etag.endswith('"')
        assert compute_etag(Thing("a", 1), ThingSchema) == etag

    def test_changes_with_represented_fields_only(self) -> None:
        etag = compute_etag(Thing("a", 1), ThingSchema)

        assert compute_etag(Thing("a", 2), ThingSchema) != etag
        assert compute_etag(Thing("a", 1, internal="other"), ThingSchema) == etag

    def test_depends_on_schema(self) -> None:
        thing = Thing("a", 1)

        assert compute_etag(thing, ThingSchema) != compute_etag(
            thing, ThingSchemaNameOnly
        )


class TestPrecondition:
    thing = Thing("a", 1)

    def test_no_header_passes(self) -> None:
        Precondition(ThingSchema, None).check(self.thing)

    def test_wildcard_passes(self) -> None:
        Precondition(ThingSchema, "*").check(self.thing)

    def test_matching_tag_passes(self) -> None:
        etag = compute_etag(self.thing, ThingSchema)
        Precondition(ThingSchema, etag).check(self.thing)

    def test_matching_tag_in_list_passes(self) -> None:
        etag = compute_etag(self.thing, ThingSchema)
        Precondition(ThingSchema, f'"stale", {etag}').check(self.thing)

    def test_stale_tag_fails(self) -> None:
        with pytest.raises(PreconditionFailed):
            Precondition(ThingSchema, '"stale"').check(self.thing)

    def test_weak_tag_fails(self) -> None:
        etag = compute_etag(self.thing, ThingSchema)
        with pytest.raises(PreconditionFailed):
            Precondition(ThingSchema, f"W/{etag}").check(self.thing)


@pytest.mark.asyncio
class TestIfMatch:
    async def test_builds_precondition_with_schema(self) -> None:
        precondition = await IfMatch(ThingSchema)(if_match='"tag"')

        assert precondition.schema is ThingSchema
        assert precondition.if_match == '"tag"'
