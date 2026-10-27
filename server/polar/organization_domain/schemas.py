from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, Field, HttpUrl, TypeAdapter
from tld import get_fld

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema

_http_url = TypeAdapter(HttpUrl)


def _validate_domain(value: str) -> str:
    value = value.strip()
    url = _http_url.validate_python(value if "://" in value else f"https://{value}")
    host = (url.host or "").rstrip(".")
    if get_fld(host, fix_protocol=True, fail_silently=True) is None:
        raise ValueError("Invalid domain name.")
    return host


DomainName = Annotated[str, AfterValidator(_validate_domain)]


class OrganizationDomainCreate(Schema):
    domain: DomainName = Field(
        description="Domain name, without scheme or path.", examples=["example.com"]
    )


class OrganizationDomain(IDSchema, TimestampedSchema):
    domain: str = Field(description="Domain name.")
    verified_at: datetime | None = Field(
        description="When Polar verified the domain. `null` while pending."
    )
    verification_record_value: str | None = Field(
        description="Value to publish in a DNS TXT record to prove ownership."
    )
