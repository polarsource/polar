import pathlib
import pprint
import typing

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from generator.code_samples import CodeSampleError, OperationSample
from python.naming import operation_name, paginator_name, service_name

TEMPLATE_DIRECTORY = pathlib.Path(__file__).parent / "template"
ENVIRONMENT = Environment(
    loader=FileSystemLoader(TEMPLATE_DIRECTORY),
    undefined=StrictUndefined,
    keep_trailing_newline=True,
)
ENVIRONMENT.filters["python_literal"] = lambda value: pprint.pformat(
    value, width=72, sort_dicts=False
)
TEMPLATE = ENVIRONMENT.get_template("code_sample.py.jinja")


def language_label() -> str:
    return "Python (New SDK)"


def render_code_sample(sample: OperationSample) -> str:
    positional_arguments = [
        sample_parameter.value for sample_parameter in sample.path_parameters
    ]
    keyword_arguments: dict[str, typing.Any] = {}
    for sample_parameter in sample.query_parameters:
        keyword_arguments[sample_parameter.parameter.parameter_name] = (
            sample_parameter.value
        )
    if sample.method.body is not None:
        if not isinstance(sample.body, dict):
            raise CodeSampleError("Python request bodies must be object schemas")
        keyword_arguments.update(sample.body)

    client_path = ".".join(service_name(name) for name in sample.service_path)
    method_name = (
        paginator_name(sample.method.name)
        if sample.method.pagination is not None
        else operation_name(sample.method.name)
    )
    return (
        TEMPLATE.render(
            version=f"v{sample.api.version.replace('-', '_').replace('.', '_')}",
            call_path=f"polar.{client_path}.{method_name}",
            positional_arguments=positional_arguments,
            keyword_arguments=keyword_arguments,
            pagination=sample.method.pagination is not None,
            has_response=sample.method.response_type != "none",
        ).rstrip()
        + "\n"
    )
