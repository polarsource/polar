import json
import pathlib
import typing

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from generator.code_samples import OperationSample
from typescript.naming import operation_name, paginator_name, service_name

TEMPLATE_DIRECTORY = pathlib.Path(__file__).parent / "template"
ENVIRONMENT = Environment(
    loader=FileSystemLoader(TEMPLATE_DIRECTORY),
    undefined=StrictUndefined,
    keep_trailing_newline=True,
)
ENVIRONMENT.filters["typescript_literal"] = lambda value: json.dumps(
    value, indent=2, ensure_ascii=False
)
TEMPLATE = ENVIRONMENT.get_template("code_sample.ts.jinja")


def language_label() -> str:
    return "TypeScript"


def render_code_sample(sample: OperationSample) -> str:
    arguments: list[typing.Any] = [
        sample_parameter.value for sample_parameter in sample.path_parameters
    ]
    if sample.method.query_params and (
        sample.query_parameters or sample.method.body is not None
    ):
        arguments.append(
            {
                sample_parameter.parameter.name: sample_parameter.value
                for sample_parameter in sample.query_parameters
            }
        )
    if sample.method.body is not None:
        arguments.append(sample.body)

    client_path = ".".join(service_name(name) for name in sample.service_path)
    method_name = (
        paginator_name(sample.method.name)
        if sample.method.pagination is not None
        else operation_name(sample.method.name)
    )
    return (
        TEMPLATE.render(
            version=sample.api.version,
            call_path=f"polar.{client_path}.{method_name}",
            arguments=arguments,
            pagination=sample.method.pagination is not None,
            has_response=sample.method.response_type != "none",
        ).rstrip()
        + "\n"
    )
