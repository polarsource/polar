import openapi_pydantic as op


def is_private_cli_operation(operation: op.Operation) -> bool:
    tags = operation.tags or []
    return "cli" not in tags or "private" in tags
