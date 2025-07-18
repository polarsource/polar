import re

RE_HTML_TAG = re.compile(r"<[^>]*>")


def dangerously_strip_tags(html_input: str) -> str:
    """
    This function TRIES to remove HTML tags from a string, however
    it's is highly likely that an attacker would be able to still
    end up with dangerous HTML in the returned string.

    Therefore use DO NOT use this not as a sanitizer, but rather for making
    HTML that is known to be safe into plaintext.
    """

    result = re.sub(RE_HTML_TAG, "", html_input)

    # Replace any leftover "<" and ">"s with their HTML entities
    result = result.replace("<", "&lt;")
    result = result.replace(">", "&gt;")

    return result
