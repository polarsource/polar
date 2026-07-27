import openapi_pydantic as op

from generator.code_samples import generate_code_samples_overlay
from generator.ir import generate_ir


def test_renders_code_samples(
    code_samples_spec: op.OpenAPI,
) -> None:
    api = generate_ir(code_samples_spec).versions[0]
    overlay = generate_code_samples_overlay(api, "1.2.3", ["typescript"])
    sources = {
        action["target"]: action["update"]["x-codeSamples"][0]["source"]
        for action in overlay["actions"]
    }

    assert sources['$["paths"]["/health"]["get"]'] == (
        'import { createPolar } from "@polar-sh/sdk/2026-04";\n'
        "\n"
        "const polar = createPolar({\n"
        '  accessToken: "polar_oat_xxx",\n'
        "});\n"
        "\n"
        "await polar.health.get();\n"
    )
    pagination = sources['$["paths"]["/accounts/{account_id}/payment-methods"]["get"]']
    assert (
        "for await (const item of polar.accounts.paymentMethods.iterList(" in pagination
    )
    assert '"label": "primary"' in pagination
    assert "process.env" not in pagination
    assert "async function" not in pagination

    widget = sources['$["paths"]["/widgets"]["post"]']
    assert '"kind": "physical"' in widget
    assert '"type": "physical"' in widget
    assert '"note": "Limited edition"' in widget
    assert '"archived_at": null' in widget
