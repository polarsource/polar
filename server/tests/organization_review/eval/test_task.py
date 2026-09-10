from polar.organization_review.eval.task import CONTEXT_MAP
from polar.organization_review.schemas import ReviewContext


class TestContextMap:
    """CONTEXT_MAP routes a case's persisted review_type string to the
    ReviewContext enum that selects the analyzer preamble. A missing key
    silently falls through ``.get(..., ReviewContext.THRESHOLD)`` and scores
    the case under the wrong preamble — this guard prevents that class of bug.
    """

    def test_covers_every_review_context_enum_value(self) -> None:
        # Any new ReviewContext value must get an explicit CONTEXT_MAP entry,
        # otherwise it silently defaults to THRESHOLD (exactly how APPEAL broke).
        enum_keys = {ctx.value for ctx in ReviewContext}
        assert enum_keys <= set(CONTEXT_MAP)

    def test_each_review_context_key_maps_to_its_own_value(self) -> None:
        for ctx in ReviewContext:
            assert CONTEXT_MAP[ctx.value] is ctx
