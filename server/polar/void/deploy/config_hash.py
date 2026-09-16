"""Stable identity for a validated deployment's configuration."""

import hashlib
import json
from decimal import Decimal
from typing import Any

from pydantic import BaseModel


def _normalize(value: Any) -> Any:
    if isinstance(value, Decimal):
        # Equivalent prices (1, 1.0, 1.00) identify the same configuration.
        text = format(value, "f")
        return text.rstrip("0").rstrip(".") if "." in text else text
    if isinstance(value, dict):
        return {key: _normalize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_normalize(item) for item in value]
    return value


def configuration_hash(config: BaseModel) -> str:
    payload = _normalize(
        config.model_dump(exclude={"checksum", "dry_run", "preview", "activate"})
    )
    for key in ("reducers", "meters", "products", "entitlements"):
        payload[key].sort(key=lambda item: item["slug"])
    for product in payload["products"]:
        # A product meter is a slug, or a slug with terms; order both by slug.
        product["meters"].sort(
            key=lambda item: item["slug"] if isinstance(item, dict) else item
        )
        product["entitlements"].sort()
    encoded = json.dumps(
        {"version": 1, **payload},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()
