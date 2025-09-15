from pydantic import HttpUrl, TypeAdapter


def validate_http_url(url: str | None) -> str | None:
    if not url:
        return None
    TypeAdapter(HttpUrl).validate_python(url)
    return url
