import openapi_pydantic as op

from generator.ir import APIIR, generate_ir


def generate_cli_ir(spec: op.OpenAPI) -> APIIR:
    ir = generate_ir(
        spec,
        is_private_operation=lambda operation: (
            "cli" not in (operation.tags or []) or "private" in (operation.tags or [])
        ),
    )
    if not ir.versions[0].services:
        raise ValueError(
            "No public CLI-tagged operations found. Regenerate OpenAPI from the "
            "backend with APITag.cli annotations before generating commands."
        )
    return ir
