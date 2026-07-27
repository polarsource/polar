from generator.casing import to_camel_case


def operation_name(name: str) -> str:
    return to_camel_case(name)


def service_name(name: str) -> str:
    return to_camel_case(name)


def paginator_name(name: str) -> str:
    return to_camel_case(f"iter_{name}")


def exported_operation_name(name: str, service_name: str) -> str:
    return f"{operation_name(name)}{service_name}"


def exported_paginator_name(name: str, service_name: str) -> str:
    return f"{paginator_name(name)}{service_name}"
