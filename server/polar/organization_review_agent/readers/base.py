"""Reader primitive: untrusted-text-in, structured-cues-out.

The reader/investigator split is the v2 module's main containment
discipline. Untrusted merchant content (scraped HTML, Plain inbound
messages, appeal text, uploaded documents) is processed by a small
purpose-built LLM agent that emits *structured* cues. The deciding LLM
never sees the raw text — only the cues. This protects Decide from
prompt injection lurking in merchant-supplied content and keeps the
audit log focused on what was extracted, not what was scraped.

Subclasses pick a narrow input type and a narrow cues type and provide
the ``_extract`` implementation. Tracing, error handling, redaction
discipline, and cost rollup live in the base.
"""

from __future__ import annotations

import abc
from typing import Generic, TypeVar

import structlog

from polar.exceptions import PolarError

from ..schemas import ReaderCues

log = structlog.get_logger(__name__)

CueT = TypeVar("CueT", bound=ReaderCues)
"""The structured cues a Reader produces. Subclasses narrow this."""

InputT = TypeVar("InputT")
"""The (typically untrusted) input the Reader consumes."""


class ReaderError(PolarError):
    """Raised when a reader fails to extract cues from input.

    Callers should generally not catch this — failures here usually
    indicate either an upstream pipeline issue (LLM provider outage) or
    a hostile input the reader cannot safely interpret. Both warrant
    bubbling to the surrounding lane / graph node so the run lands in
    FAILED rather than producing degraded cues.
    """


class Reader(abc.ABC, Generic[InputT, CueT]):
    """Base class for sandboxed extractors over untrusted external text.

    Subclasses set :attr:`source` and implement :meth:`_extract`. The
    public :meth:`read` wraps the extraction with logging + error
    surfacing so call sites stay terse.

    Subclassing convention::

        class MerchantMessageReader(
            Reader[str, MerchantReplyCues]
        ):
            source = "plain_inbound"

            async def _extract(self, raw: str) -> MerchantReplyCues:
                ...

    Implementations MUST NOT return the raw input verbatim through
    fields other than :attr:`ReaderCues.quoted_excerpts`, and even
    those should be capped (the convention is <200 chars per excerpt)
    so that a hostile payload cannot smuggle large bodies through the
    cues channel.
    """

    source: str
    """Stable identifier surfaced on every cue this reader produces.

    Use snake_case: ``"website_page"``, ``"plain_inbound"``,
    ``"appeal_reason"``. Read at log time and stamped onto every
    produced :class:`ReaderCues`.
    """

    def __init_subclass__(cls, **kwargs: object) -> None:
        super().__init_subclass__(**kwargs)
        if abc.ABC in cls.__bases__:
            return
        if not getattr(cls, "source", None):
            raise TypeError(
                f"Reader subclass {cls.__name__} must define a 'source' "
                f"class attribute."
            )

    @abc.abstractmethod
    async def _extract(self, raw: InputT) -> CueT:
        """Produce cues from a single untrusted input.

        Implementations should:

        * Apply LLM-driven structured extraction (typically a
          pydantic-ai Agent with ``output_type=<CueT subclass>``).
        * Redact PII / secrets before emitting cues. The reader is the
          last line of defence — Decide assumes cues are safe.
        * Set :attr:`ReaderCues.source` to ``self.source``.
        """

    async def read(self, raw: InputT) -> CueT:
        """Run extraction with consistent logging + error semantics.

        On exception, logs the failure and re-raises as :class:`ReaderError`.
        The caller (a lane, or the graph's ingestion node) decides whether
        to retry, skip, or fail the run.
        """

        log.info("reader.start", source=self.source)
        try:
            cues = await self._extract(raw)
        except Exception as exc:
            log.exception("reader.failed", source=self.source)
            raise ReaderError(
                f"{type(self).__name__} ({self.source}) failed to extract cues"
            ) from exc

        if cues.source != self.source:
            # Subclasses sometimes forget to stamp source; do it for them
            # rather than fail noisily. The invariant matters for trace
            # filtering more than at the extraction call site.
            object.__setattr__(cues, "source", self.source)

        log.info(
            "reader.complete",
            source=self.source,
            addressed_signal_kinds=[k.value for k in cues.addressed_signal_kinds],
            excerpt_count=len(cues.quoted_excerpts),
        )
        return cues
