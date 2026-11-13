import pytest
from pydantic import ValidationError
from pydantic.json_schema import models_json_schema

from polar.declarative_config.schemas import (
    Config,
    ConfigExport,
    ConfigWebhookEndpoint,
)
from polar.version import CURRENT_API_VERSION


def test_export_schema_is_not_split() -> None:
    _, definitions = models_json_schema(
        [(Config, "validation"), (ConfigExport, "serialization")],
        ref_template="#/components/schemas/{model}",
    )
    split = [
        name
        for name in definitions["$defs"]
        if name.startswith("Config") and name.endswith(("-Input", "-Output"))
    ]
    assert split == []


def test_webhook_endpoint_rejects_mcp_format() -> None:
    with pytest.raises(ValidationError, match="literal_error"):
        ConfigWebhookEndpoint.model_validate(
            {
                "external_id": "mcp",
                "url": "https://example.com/webhook",
                "format": "mcp",
                "events": ["order.created"],
                "api_version": str(CURRENT_API_VERSION),
            }
        )
