"""Sandboxed adapters between untrusted external content and Decide.

See ``base.py`` for the :class:`Reader` protocol. Concrete readers
(website Director, merchant Plain replies, appeal text) land in
subsequent slices.
"""

from .base import Reader, ReaderError
from .merchant_message import MerchantMessageReader, MerchantReplyCues
from .website import WebsiteCues, WebsiteReader

__all__ = [
    "MerchantMessageReader",
    "MerchantReplyCues",
    "Reader",
    "ReaderError",
    "WebsiteCues",
    "WebsiteReader",
]
