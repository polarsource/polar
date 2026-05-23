"""Sandboxed adapters between untrusted external content and Decide.

See ``base.py`` for the :class:`Reader` protocol. Concrete readers
(website Director, merchant Plain replies, appeal text) land in
subsequent slices.
"""

from .base import Reader, ReaderError
from .website import WebsiteCues, WebsiteReader

__all__ = ["Reader", "ReaderError", "WebsiteCues", "WebsiteReader"]
