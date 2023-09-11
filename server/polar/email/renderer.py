from typing import Any
from jinja2 import Environment, PackageLoader, select_autoescape, StrictUndefined


class EmailRenderer:
    def __init__(self) -> None:
        self.env = Environment(
            loader=PackageLoader("polar.email", "templates"),
            autoescape=select_autoescape(),
            undefined=StrictUndefined,
        )

    def render_from_string(
        self, subject: str, body: str, context: dict[str, Any]
    ) -> tuple[str, str]:
        rendered_subject = self.env.from_string(subject).render(context).strip()

        wrapped_body = """
        {{% extends 'base.html' %}}

        {{% block body %}}
            {body}
        {{% endblock %}}
        """.format(
            body=body
        )

        rendered_body = self.env.from_string(wrapped_body).render(context).strip()
        return rendered_subject, rendered_body


def get_email_renderer() -> EmailRenderer:
    return EmailRenderer()
