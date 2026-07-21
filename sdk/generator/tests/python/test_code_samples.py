import ast

import openapi_pydantic as op

from generator.code_samples import generate_code_samples_overlay
from generator.ir import generate_ir


def test_renders_code_samples(
    code_samples_spec: op.OpenAPI,
) -> None:
    api = generate_ir(code_samples_spec).versions[0]
    overlay = generate_code_samples_overlay(api, "1.2.3", ["python"])
    sources = {
        action["target"]: action["update"]["x-codeSamples"][0]["source"]
        for action in overlay["actions"]
    }

    assert sources['$["paths"]["/health"]["get"]'] == (
        "from polar.v2026_04 import Polar\n"
        "\n"
        'polar = Polar("polar_oat_xxx")\n'
        "\n"
        "polar.health.get()\n"
    )
    pagination = sources['$["paths"]["/accounts/{account_id}/payment-methods"]["get"]']
    assert "for item in polar.accounts.payment_methods.iter_list(" in pagination
    assert "'00000000-0000-4000-8000-000000000000'," in pagination
    assert "account_id=" not in pagination
    assert "os.environ" not in pagination
    assert "with Polar" not in pagination

    widget = sources['$["paths"]["/widgets"]["post"]']
    assert "kind='physical'" in widget
    assert "details={'type': 'physical', 'weight': 1.0}" in widget
    assert "note='Limited edition'" in widget
    assert "archived_at=None" in widget
    for source in sources.values():
        ast.parse(source)
