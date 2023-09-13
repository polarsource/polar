from typing import Any
from collections.abc import Mapping

from jinja2 import (
    Environment,
    PackageLoader,
    select_autoescape,
    StrictUndefined,
    PrefixLoader,
    ChoiceLoader,
)

EMAIL_TEMPLATES_FOLDER_NAME = "email_templates"


class EmailRenderer:
    def __init__(self, extras_templates_packages: Mapping[str, str] = {}) -> None:
        """
        Args:
            extras_templates_package: Optional mapping to load additional templates.
                Key is the prefix that will be used to load the templates,
                e.g. `magic_link/template.html`.
                Value is the namespace of the package containing an `email_templates`
                directory containing Jinja templates.

        Example:

            ```py
            email_renderer = EmailRenderer({"magic_link": "polar.magic_link"})
            ```
        """
        self.env = Environment(
            loader=ChoiceLoader(
                [
                    PackageLoader("polar.email", EMAIL_TEMPLATES_FOLDER_NAME),
                    PrefixLoader(
                        {
                            prefix: PackageLoader(package, EMAIL_TEMPLATES_FOLDER_NAME)
                            for prefix, package in extras_templates_packages.items()
                        }
                    ),
                ]
            ),
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

    def render_from_template(
        self, subject: str, body_template: str, context: dict[str, Any]
    ) -> tuple[str, str]:
        rendered_subject = self.env.from_string(subject).render(context).strip()
        rendered_body = self.env.get_template(body_template).render(context).strip()
        return rendered_subject, rendered_body


def get_email_renderer(
    extras_templates_packages: Mapping[str, str] = {}
) -> EmailRenderer:
    return EmailRenderer(extras_templates_packages)
