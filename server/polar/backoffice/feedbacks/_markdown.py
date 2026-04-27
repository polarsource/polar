"""Render plain-text Markdown messages into the active tagflow document."""

import xml.etree.ElementTree as ET

from markdown_it import MarkdownIt
from tagflow.tagflow import node

_md = MarkdownIt(
    "commonmark",
    {"breaks": True, "html": False, "linkify": True, "xhtmlOut": True},
)


def render_markdown(source: str) -> None:
    """Append the rendered Markdown of `source` to the current tagflow node.

    Raw HTML in the source is disabled and `xhtmlOut` is enabled so the
    output is well-formed XML that ElementTree can parse without choking
    on void tags like `<br>`.
    """
    rendered = _md.render(source).strip()
    parsed = ET.fromstring(f"<root>{rendered}</root>")
    current = node.get()
    if parsed.text:
        if len(current) == 0:
            current.text = (current.text or "") + parsed.text
        else:
            last = current[-1]
            last.tail = (last.tail or "") + parsed.text
    for child in parsed:
        current.append(child)
