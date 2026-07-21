import json
import pathlib

import openapi_pydantic as op
import pytest

from generator.code_samples import (
    CodeSampleError,
    ExampleGenerator,
    generate_code_samples_overlay,
    generate_code_samples_overlays,
    write_code_samples_overlays,
)
from generator.ir import generate_ir


def test_overlay_is_complete_and_excludes_non_sdk_operations(
    code_samples_spec: op.OpenAPI,
) -> None:
    api = generate_ir(code_samples_spec).versions[0]
    overlay = generate_code_samples_overlay(api, "1.2.3", ["python", "typescript"])

    assert overlay["overlay"] == "1.1.0"
    assert overlay["info"]["title"] == "Polar 2026-04 SDK code samples"
    assert overlay["info"]["version"] == "1.2.3"
    assert len(overlay["actions"]) == 3
    targets = [action["target"] for action in overlay["actions"]]
    assert len(targets) == len(set(targets))
    assert all(
        [sample["lang"] for sample in action["update"]["x-codeSamples"]]
        == ["Python (New SDK)", "TypeScript (New SDK)"]
        for action in overlay["actions"]
    )
    assert all("/private" not in action["target"] for action in overlay["actions"])
    assert all("webhook" not in action["target"] for action in overlay["actions"])


def test_writes_one_overlay_per_api_version(
    tmp_path: pathlib.Path, code_samples_spec: op.OpenAPI
) -> None:
    previous_spec = code_samples_spec.model_copy(deep=True)
    previous_spec.info.version = "2025-01"
    ir = generate_ir(previous_spec, code_samples_spec)

    write_code_samples_overlays(tmp_path, ir, "1.2.3", ["python", "typescript"])

    assert sorted(path.name for path in tmp_path.iterdir()) == [
        "2025-01.overlay.json",
        "2026-04.overlay.json",
    ]
    assert (
        json.loads((tmp_path / "2025-01.overlay.json").read_text())["info"]["title"]
        == "Polar 2025-01 SDK code samples"
    )


def test_discriminator_mapping_overrides_generated_property(
    code_samples_spec: op.OpenAPI,
) -> None:
    spec = code_samples_spec.model_dump(by_alias=True, exclude_none=True)
    spec["components"]["schemas"]["PhysicalWidget"]["properties"]["type"] = {
        "type": "string"
    }
    api = generate_ir(op.OpenAPI.model_validate(spec)).versions[0]
    method = next(
        method
        for service in api.services
        for method in service.methods
        if method.operation_id == "widgets:create"
    )
    assert method.body is not None

    body = ExampleGenerator(api).generate(method.body)

    assert body["details"]["type"] == "physical"


def test_discriminator_mapping_targets_are_normalized(
    code_samples_spec: op.OpenAPI,
) -> None:
    spec = code_samples_spec.model_dump(by_alias=True, exclude_none=True)
    schemas = spec["components"]["schemas"]
    physical_widget = schemas.pop("PhysicalWidget")
    physical_widget["properties"].pop("type")
    physical_widget["required"].remove("type")
    schemas["physical_widget"] = physical_widget
    details = schemas["WidgetDetails"]
    details["oneOf"][0]["$ref"] = "#/components/schemas/physical_widget"
    details["discriminator"]["mapping"]["physical"] = (
        "#/components/schemas/physical_widget"
    )
    api = generate_ir(op.OpenAPI.model_validate(spec)).versions[0]
    union = next(union for union in api.input_unions if union.name == "WidgetDetails")
    method = next(
        method
        for service in api.services
        for method in service.methods
        if method.operation_id == "widgets:create"
    )
    assert union.discriminator is not None
    assert method.body is not None

    body = ExampleGenerator(api).generate(method.body)

    assert union.discriminator.mapping["physical"] == "PhysicalWidget"
    assert body["details"]["type"] == "physical"


def test_code_samples_fail_on_cycles(code_samples_spec: op.OpenAPI) -> None:
    spec = code_samples_spec.model_dump(by_alias=True, exclude_none=True)
    spec["components"]["schemas"]["WidgetCreate"] = {
        "type": "object",
        "title": "WidgetCreate",
        "properties": {"child": {"$ref": "#/components/schemas/WidgetCreate"}},
        "required": ["child"],
    }

    with pytest.raises(CodeSampleError, match="Cyclic input schema"):
        generate_code_samples_overlays(
            generate_ir(op.OpenAPI.model_validate(spec)),
            "1.2.3",
            ["python", "typescript"],
        )


def test_duplicate_operation_ids_are_rejected(
    code_samples_spec: op.OpenAPI,
) -> None:
    spec = code_samples_spec.model_dump(by_alias=True, exclude_none=True)
    spec["paths"]["/health"]["get"]["operationId"] = "widgets:create"

    with pytest.raises(ValueError, match="Duplicate operation ID"):
        generate_ir(op.OpenAPI.model_validate(spec))
