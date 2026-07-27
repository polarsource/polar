from generator.casing import to_snake_case


def operation_name(name: str) -> str:
    return to_snake_case(name)


def paginator_name(name: str) -> str:
    return f"iter_{operation_name(name)}"


def service_name(name: str) -> str:
    return to_snake_case(name)
