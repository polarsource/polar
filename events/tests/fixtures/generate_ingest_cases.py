"""Regenerate ingest_cases.json from the Python schema:

cd server && PYTHONPATH=. uv run python ../events/tests/fixtures/generate_ingest_cases.py
"""

import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from pydantic import TypeAdapter, ValidationError

from polar.event.schemas import EventsIngest

CUSTOMER = "0b1e7a52-9f0d-4c1b-8d5e-2f7a3c4b5d6e"
MEMBER = "7c9e6679-7425-40de-944b-e07fc1f90ae7"
EXTERNAL = {"name": "n", "external_customer_id": "c"}
LLM = {"vendor": "v", "model": "m", "input_tokens": 1, "output_tokens": 2, "total_tokens": 3}


def event(**fields: Any) -> dict[str, Any]:
    return {"events": [{**EXTERNAL, **fields}]}


def metadata(**fields: Any) -> dict[str, Any]:
    return event(metadata=fields)


CASES: dict[str, Any] = {
    "minimal": event(),
    "empty batch": {"events": []},
    "body is a list": [],
    "events missing": {},
    "events not a list": {"events": {}},
    "event not an object": {"events": [5]},
    "body is a number": 5,
    "body is null": None,
    "event is null": {"events": [None]},
    "event is a list": {"events": [[]]},
    "nul in name": event(name="a\x00b"),
    "nul in external id": event(external_id="a\x00"),
    "nul in parent id": event(parent_id="\x00"),
    "nul in external customer": {"events": [{"name": "n", "external_customer_id": "c\x00"}]},
    "nul in external member": event(external_member_id="\x00m"),
    "nul in metadata key": metadata(**{"a\x00": 1}),
    "nul in metadata value": metadata(k="\x00"),
    "nul in llm prompt": metadata(_llm={**LLM, "prompt": "\x00"}),
    "nul in cost currency": metadata(_cost={"amount": 1, "currency": "usd\x00"}),
    "customer uuid non-rfc variant": {"events": [{"name": "n", "customer_id": "0b1e7a52-9f0d-4c1b-0d5e-2f7a3c4b5d6e"}]},
    "customer uuid braced": {"events": [{"name": "n", "customer_id": "{" + CUSTOMER + "}"}]},
    "customer uuid urn": {"events": [{"name": "n", "customer_id": "urn:uuid:" + CUSTOMER}]},
    "second event invalid": {"events": [EXTERNAL, {"name": "n"}]},
    "polar customer": {"events": [{"name": "n", "customer_id": CUSTOMER}]},
    "polar customer and member": {"events": [{"name": "n", "customer_id": CUSTOMER, "member_id": MEMBER}]},
    "polar customer with null member": {"events": [{"name": "n", "customer_id": CUSTOMER, "member_id": None}]},
    "external member": event(external_member_id="m"),
    "both customers": event(customer_id=CUSTOMER),
    "both customers and members": event(customer_id=CUSTOMER, member_id=MEMBER, external_member_id="m"),
    "both customers, external member only": event(customer_id=CUSTOMER, external_member_id="m"),
    "invalid member falls back to external": event(customer_id=CUSTOMER, member_id="x"),
    "both customers, polar member only": event(customer_id=CUSTOMER, member_id=MEMBER),
    "both customers, null polar member": event(customer_id=CUSTOMER, member_id=None),
    "both customers, null external member": event(customer_id=CUSTOMER, external_member_id=None),
    "both customers with timestamp string": event(customer_id=CUSTOMER, timestamp="2025-01-01T00:00:00Z"),
    "both customers with unix timestamp": event(customer_id=CUSTOMER, timestamp=1735689600),
    "both customers with organization": event(customer_id=CUSTOMER, organization_id=CUSTOMER),
    "both customers with metadata": event(customer_id=CUSTOMER, metadata={"a": 1, "_llm": LLM}),
    "both customers with coerced tokens": event(customer_id=CUSTOMER, metadata={"_llm": {**LLM, "input_tokens": "1"}}),
    "both customers with cost": event(customer_id=CUSTOMER, metadata={"_cost": {"amount": 1.5, "currency": "usd"}}),
    "both customers with integer cost": event(customer_id=CUSTOMER, metadata={"_cost": {"amount": 1, "currency": "usd"}}),
    "both customers with string cost": event(customer_id=CUSTOMER, metadata={"_cost": {"amount": "1", "currency": "usd"}}),
    "both customers with null organization": event(customer_id=CUSTOMER, organization_id=None),
    "both customers with float metadata": event(customer_id=CUSTOMER, metadata={"f": 1.5, "b": True, "s": "x"}),
    "both customers with whole float tokens": event(customer_id=CUSTOMER, metadata={"_llm": {**LLM, "input_tokens": 1.0}}),
    "both customers with bool tokens": event(customer_id=CUSTOMER, metadata={"_llm": {**LLM, "input_tokens": True}}),
    "both customers with cached tokens": event(customer_id=CUSTOMER, metadata={"_llm": {**LLM, "cached_input_tokens": 1}}),
    "both customers with null ids": event(customer_id=CUSTOMER, external_id=None, parent_id=None),
    "both customers with empty metadata": event(customer_id=CUSTOMER, metadata={}),
    "no customer": {"events": [{"name": "n"}]},
    "customer not a uuid": {"events": [{"name": "n", "customer_id": "nope"}]},
    "customer uuid v1": {"events": [{"name": "n", "customer_id": "c232ab00-9414-11ec-b3c8-9f6bdeced846"}]},
    "customer uuid not a string": {"events": [{"name": "n", "customer_id": 5}]},
    "customer uuid without hyphens": {"events": [{"name": "n", "customer_id": CUSTOMER.replace("-", "").upper()}]},
    "external customer not a string": {"events": [{"name": "n", "external_customer_id": 5}]},
    "external customer empty": {"events": [{"name": "n", "external_customer_id": ""}]},
    "unknown field": event(foo=1),
    "name missing": {"events": [{"external_customer_id": "c"}]},
    "name empty": event(name=""),
    "name at limit": event(name="x" * 128),
    "name too long": event(name="x" * 129),
    "name multibyte at limit": event(name="é" * 128),
    "name not a string": event(name=1),
    "organization id": event(organization_id=CUSTOMER),
    "organization id invalid": event(organization_id="nope"),
    "external and parent ids": event(external_id="e", parent_id="p"),
    "null ids": event(external_id=None, parent_id=None, external_member_id=None, organization_id=None),
    "external id not a string": event(external_id=5),
    "timestamp utc": event(timestamp="2025-01-01T00:00:00Z"),
    "timestamp offset": event(timestamp="2025-01-01T02:00:00+02:00"),
    "timestamp fraction": event(timestamp="2025-01-01T00:00:00.123456Z"),
    "timestamp space separator": event(timestamp="2025-01-01 00:00:00+00:00"),
    "timestamp compact offset": event(timestamp="2025-01-01T00:00:00+0200"),
    "timestamp without seconds": event(timestamp="2025-01-01T00:00+00:00"),
    "timestamp naive": event(timestamp="2025-01-01T00:00:00"),
    "timestamp date only": event(timestamp="2025-01-01"),
    "timestamp future": event(timestamp="2999-01-01T00:00:00Z"),
    "timestamp unix seconds": event(timestamp=1735689600),
    "timestamp unix milliseconds": event(timestamp=1735689600000),
    "timestamp unix float": event(timestamp=1735689600.5),
    "timestamp numeric string": event(timestamp="1735689600"),
    "timestamp null": event(timestamp=None),
    "timestamp garbage": event(timestamp="yesterday"),
    "timestamp bool": event(timestamp=True),
    "timestamp before year one": event(timestamp=-1e15),
    "timestamp year zero": event(timestamp="0000-01-01T00:00:00Z"),
    "timestamp year 9999": event(timestamp=253402300799),
    "timestamp surrounding whitespace": event(timestamp=" 2025-01-01T00:00:00Z "),
    "timestamp numeric string with whitespace": event(timestamp=" 1735689600 "),
    "timestamp exponent string": event(timestamp="1e9"),
    "timestamp float string": event(timestamp="1735689600.5"),
    "timestamp negative numeric string": event(timestamp="-1"),
    "timestamp negative unix": event(timestamp=-1),
    "timestamp hour-only offset": event(timestamp="2025-01-01T00:00:00+02"),
    "timestamp leap second": event(timestamp="2024-12-31T23:59:60Z"),
    "timestamp nanoseconds": event(timestamp="2025-01-01T00:00:00.123456789Z"),
    "timestamp comma fraction": event(timestamp="2025-01-01T00:00:00,5Z"),
    "timestamp lowercase designators": event(timestamp="2025-01-01t00:00:00z"),
    "timestamp without seconds utc": event(timestamp="2025-01-01T00:00Z"),
    "timestamp underscore separator": event(timestamp="2025-01-01_00:00:00Z"),
    "timestamp ten fraction digits": event(timestamp="2025-01-01T00:00:00.1234567890Z"),
    "timestamp invalid day": event(timestamp="2025-02-30T00:00:00Z"),
    "timestamp hour 24": event(timestamp="2025-01-01T24:00:00Z"),
    "timestamp negative offset": event(timestamp="2025-01-01T00:00:00-05:30"),
    "timestamp plus sign numeric string": event(timestamp="+1735689600"),
    "timestamp trailing dot numeric string": event(timestamp="1735689600."),
    "timestamp date and time only hour": event(timestamp="2025-01-01T00Z"),
    "timestamp empty string": event(timestamp=""),
    "timestamp unix zero": event(timestamp=0),
    "timestamp huge unix": event(timestamp=1e300),
    "timestamp single digit fields": event(timestamp="2025-1-1T1:2:3Z"),
    "timestamp two digit year": event(timestamp="25-01-01T00:00:00Z"),
    "timestamp signed year": event(timestamp="+2025-01-01T00:00:00Z"),
    "timestamp negative year": event(timestamp="-0001-01-01T00:00:00Z"),
    "timestamp space before offset": event(timestamp="2025-01-01T00:00:00 +02:00"),
    "timestamp trailing space date": event(timestamp="2025-01-01 "),
    "timestamp naive with second 60": event(timestamp="2025-01-01T00:00:60"),
    "timestamp inf string": event(timestamp="inf"),
    "timestamp negative millis before year one": event(timestamp=-1e14),
    "metadata scalars": metadata(s="a", i=1, f=1.5, b=True, whole=1.0, exponent=1e3, negative=-1),
    "metadata numeric limits": metadata(high=2**53 - 1, low=-(2**53) + 1),
    "metadata integer too large": metadata(big=2**53),
    "metadata integer too small": metadata(small=-(2**53)),
    "metadata float too large": metadata(big=1e300),
    "metadata string empty": metadata(s=""),
    "metadata string at limit": metadata(s="x" * 500),
    "metadata string too long": metadata(s="x" * 501),
    "metadata null value": metadata(s=None),
    "metadata nested object": metadata(s={"a": 1}),
    "metadata list": metadata(s=[1]),
    "metadata long and empty keys": metadata(**{"k" * 41: 1, "": 2}),
    "metadata many keys": metadata(**{f"k{i}": i for i in range(60)}),
    "metadata null": event(metadata=None),
    "metadata not an object": event(metadata=[1]),
    "cost": metadata(_cost={"amount": 1.5, "currency": "usd"}),
    "cost integer amount": metadata(_cost={"amount": 2, "currency": "usd"}),
    "cost string amount": metadata(_cost={"amount": "0.000000000001", "currency": "usd"}),
    "cost exponent amount": metadata(_cost={"amount": "1e-5", "currency": "usd"}),
    "cost extra key": metadata(_cost={"amount": 1, "currency": "usd", "x": 1}),
    "cost currency contains usd": metadata(_cost={"amount": 1, "currency": "xusdx"}),
    "cost wrong currency": metadata(_cost={"amount": 1, "currency": "eur"}),
    "cost too many decimal places": metadata(_cost={"amount": "0.0000000000001", "currency": "usd"}),
    "cost too many digits": metadata(_cost={"amount": "123456789012345678", "currency": "usd"}),
    "cost amount not a number": metadata(_cost={"amount": "abc", "currency": "usd"}),
    "cost missing fields": metadata(_cost={}),
    "cost not an object": metadata(_cost=5),
    "cost whole digits at limit": metadata(_cost={"amount": 99999, "currency": "usd"}),
    "cost too many whole digits": metadata(_cost={"amount": 123456, "currency": "usd"}),
    "cost too many whole digits with fraction": metadata(_cost={"amount": 100000.5, "currency": "usd"}),
    "cost too many whole digits exponent": metadata(_cost={"amount": "1e5", "currency": "usd"}),
    "cost huge float": metadata(_cost={"amount": 1e16, "currency": "usd"}),
    "cost underscore amount": metadata(_cost={"amount": "1_000", "currency": "usd"}),
    "cost negative amount": metadata(_cost={"amount": -1.5, "currency": "usd"}),
    "cost bool amount": metadata(_cost={"amount": True, "currency": "usd"}),
    "cost leading zeros": metadata(_cost={"amount": "000001.50", "currency": "usd"}),
    "cost trailing zeros": metadata(_cost={"amount": "1.5000000000000", "currency": "usd"}),
    "cost padded amount": metadata(_cost={"amount": " 1.5 ", "currency": "usd"}),
    "cost zero": metadata(_cost={"amount": 0, "currency": "usd"}),
    "cost zero with many places": metadata(_cost={"amount": "0.00000000000000", "currency": "usd"}),
    "cost nan": metadata(_cost={"amount": "NaN", "currency": "usd"}),
    "cost infinity": metadata(_cost={"amount": "Infinity", "currency": "usd"}),
    "cost plus sign": metadata(_cost={"amount": "+1.5", "currency": "usd"}),
    "cost leading dot": metadata(_cost={"amount": ".5", "currency": "usd"}),
    "cost trailing dot": metadata(_cost={"amount": "5.", "currency": "usd"}),
    "cost max digits with places": metadata(_cost={"amount": "12345.123456789012", "currency": "usd"}),
    "cost empty string": metadata(_cost={"amount": "", "currency": "usd"}),
    "cost huge negative exponent": metadata(_cost={"amount": "1e-9223372036854775808", "currency": "usd"}),
    "cost huge positive exponent": metadata(_cost={"amount": "1e9223372036854775807", "currency": "usd"}),
    "cost large negative exponent": metadata(_cost={"amount": "1e-400", "currency": "usd"}),
    "cost rounds up to six whole digits": metadata(_cost={"amount": 99999.999999999999, "currency": "usd"}),
    "llm": metadata(_llm=LLM),
    "llm all fields": metadata(_llm={**LLM, "prompt": None, "response": "r", "cached_input_tokens": 1, "extra": 1}),
    "llm coerced tokens": metadata(_llm={**LLM, "input_tokens": 1.0, "output_tokens": "2"}),
    "llm fractional tokens": metadata(_llm={**LLM, "total_tokens": 3.5}),
    "llm tokens too large": metadata(_llm={**LLM, "total_tokens": 2**53}),
    "llm null cached tokens": metadata(_llm={**LLM, "cached_input_tokens": None}),
    "llm missing fields": metadata(_llm={"vendor": "v"}),
    "llm not an object": metadata(_llm="x"),
    "llm float string tokens": metadata(_llm={**LLM, "input_tokens": "2.0"}),
    "llm bool tokens": metadata(_llm={**LLM, "input_tokens": True}),
    "llm underscore tokens": metadata(_llm={**LLM, "input_tokens": "1_000"}),
    "llm tokens too small": metadata(_llm={**LLM, "input_tokens": -1e30}),
    "llm tokens padded string": metadata(_llm={**LLM, "input_tokens": " 2 "}),
    "llm tokens fractional string": metadata(_llm={**LLM, "input_tokens": "2.5"}),
    "llm tokens float above safe range": metadata(_llm={**LLM, "input_tokens": 1e17}),
    "llm tokens huge float": metadata(_llm={**LLM, "input_tokens": 1e30}),
    "llm tokens above i64": metadata(_llm={**LLM, "input_tokens": 2**63 + 5}),
    "llm tokens huge string": metadata(_llm={**LLM, "input_tokens": "99999999999999999999"}),
    "llm tokens plus sign string": metadata(_llm={**LLM, "input_tokens": "+2"}),
    "llm tokens bad underscores": metadata(_llm={**LLM, "input_tokens": "1__000"}),
    "llm tokens trailing dot": metadata(_llm={**LLM, "input_tokens": "2."}),
    "llm tokens empty string": metadata(_llm={**LLM, "input_tokens": ""}),
    "llm tokens negative": metadata(_llm={**LLM, "input_tokens": -5}),
}

FASTAPI_BODY_ADAPTER = TypeAdapter(EventsIngest)
UNION_TAGS = {"constrained-str", "constrained-int", "constrained-float", "bool"}


def dump_default(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def expected(body: Any) -> dict[str, Any]:
    try:
        ingest = FASTAPI_BODY_ADAPTER.validate_python(body, from_attributes=True)
    except ValidationError as e:
        errors: list[dict[str, Any]] = []
        for error in e.errors():
            loc = ["body", *error["loc"]]
            is_union_member = loc[-1] in UNION_TAGS
            item = {
                "loc": loc[:-1] if is_union_member else loc,
                "type": None if is_union_member else error["type"],
            }
            if item not in errors:
                errors.append(item)
        return {"errors": errors}
    events = []
    for index, event in enumerate(ingest.events):
        dumped = event.model_dump(by_alias=True)
        if "timestamp" not in body["events"][index]:
            del dumped["timestamp"]
        events.append({"variant": type(event).__name__, **dumped})
    return {"events": events}


cases = [{"name": name, "body": body, **expected(body)} for name, body in CASES.items()]
output = Path(__file__).parent / "ingest_cases.json"
output.write_text(json.dumps(cases, indent=2, default=dump_default) + "\n")
