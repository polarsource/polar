from pydantic.json_schema import models_json_schema

from polar.declarative_config.schemas import Config, ConfigExport


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


def test_custom_benefit_note_defaults_to_none() -> None:
    config = Config.model_validate(
        {
            "benefits": [
                {"type": "custom", "external_id": "support", "description": "Support"}
            ]
        }
    )

    assert config.model_dump(mode="json")["benefits"][0]["properties"] == {"note": None}
