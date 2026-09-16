from uuid import UUID, uuid5

PLATFORM_CASES = ("structured", "stdlib", "exception")
SPAN_CASES = (*PLATFORM_CASES, "logfire")
MANIFEST_PREFIX = "PII_VALIDATION_MANIFEST "


def sensitive_fields(run_id: UUID) -> dict[str, str]:
    return {
        "email": f"pii-canary-{run_id.hex}@example.invalid",
        "customer_name": f"PII-CANARY-NAME-{run_id.hex}",
        "phone": "+1-202-555-0199",
        "address": f"PII-CANARY-ADDRESS-{run_id.hex}",
        "processor_id": f"pm_canary_{run_id.hex}",
        "password": f"PII-CANARY-PASSWORD-{run_id.hex}",
    }


def sensitive_text(run_id: UUID) -> dict[str, str]:
    return {
        "email": sensitive_fields(run_id)["email"],
        "card_number": "4242 4242 4242 4242",
        "iban": "GB82WEST12345698765432",
        "jwt": f"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjYW5hcnkifQ.{run_id.hex}",
        "bearer": f"Bearer pii-bearer-canary-{run_id.hex}",
        "stripe_secret": f"sk_test_CANARY{run_id.hex}",
    }


def customer_id(run_id: UUID) -> str:
    return str(uuid5(run_id, "customer"))


def marker(run_id: UUID, case: str) -> str:
    return f"pii-validation:{run_id}:{case}"
