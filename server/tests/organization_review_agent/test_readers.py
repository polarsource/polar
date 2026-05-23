"""Tests for ``polar.organization_review_agent.readers.base``.

The Reader primitive's discipline is the v2 module's main protection
against prompt injection from untrusted merchant content. These tests
cover the structural invariants: source-stamping, error wrapping,
required ``source`` attribute on subclasses.
"""

from __future__ import annotations

import pytest

from polar.organization_review_agent.readers import Reader, ReaderError
from polar.organization_review_agent.schemas import ReaderCues, SignalKind


class _StubCues(ReaderCues):
    pass


class _StubReader(Reader[str, _StubCues]):
    source = "stub_source"

    async def _extract(self, raw: str) -> _StubCues:
        return _StubCues(
            source=self.source,
            summary=f"stub({len(raw)} chars)",
        )


class _ForgetSourceReader(Reader[str, _StubCues]):
    source = "forget_source"

    async def _extract(self, raw: str) -> _StubCues:
        # Deliberately stamp the wrong source; base.read() corrects it.
        return _StubCues(source="other_source", summary="x")


class _BoomReader(Reader[str, _StubCues]):
    source = "boom_source"

    async def _extract(self, raw: str) -> _StubCues:
        raise RuntimeError("upstream LLM failure")


class TestReaderBase:
    @pytest.mark.asyncio
    async def test_read_returns_cues(self) -> None:
        reader = _StubReader()
        cues = await reader.read("merchant says hi")
        assert cues.source == "stub_source"
        assert "stub(" in cues.summary

    @pytest.mark.asyncio
    async def test_read_overwrites_wrong_source(self) -> None:
        """A reader subclass that forgets to stamp ``source`` correctly
        shouldn't poison downstream trace filtering. Base ``read`` fixes
        the cue's source to match the reader's declared source so the
        invariant always holds at the call site.
        """

        reader = _ForgetSourceReader()
        cues = await reader.read("merchant text")
        assert cues.source == "forget_source"

    @pytest.mark.asyncio
    async def test_read_wraps_exceptions_as_reader_error(self) -> None:
        """Extraction failures bubble as :class:`ReaderError` so callers
        can pattern-match on a single exception type. Original exception
        chains via ``__cause__`` so the underlying cause stays visible.
        """

        reader = _BoomReader()
        with pytest.raises(ReaderError) as excinfo:
            await reader.read("anything")
        assert isinstance(excinfo.value.__cause__, RuntimeError)
        assert "boom_source" in str(excinfo.value)

    def test_subclass_must_declare_source(self) -> None:
        """A subclass that omits ``source`` is a programmer error —
        every cue would carry an empty string and trace filtering would
        collapse across unrelated readers. Catch it at class-creation
        time.
        """

        with pytest.raises(TypeError, match="source"):

            class _Forgot(Reader[str, _StubCues]):
                # No source attribute.
                async def _extract(self, raw: str) -> _StubCues:
                    return _StubCues(source="", summary="x")


class TestReaderCuesPassthroughOnReal:
    """Sanity: a concrete reader can populate the cue fields the design
    expects (addressed signals, excerpts, tone)."""

    class _RichReader(Reader[str, ReaderCues]):
        source = "rich_source"

        async def _extract(self, raw: str) -> ReaderCues:
            return ReaderCues(
                source=self.source,
                summary="merchant addressed dispute concerns",
                addressed_signal_kinds=[SignalKind.HIGH_DISPUTE_RATE],
                tone="cooperative",
                quoted_excerpts=["sorry about that"],
            )

    @pytest.mark.asyncio
    async def test_rich_cues(self) -> None:
        cues = await self._RichReader().read("merchant explanation text")
        assert cues.addressed_signal_kinds == [SignalKind.HIGH_DISPUTE_RATE]
        assert cues.tone == "cooperative"
        assert cues.quoted_excerpts == ["sorry about that"]
