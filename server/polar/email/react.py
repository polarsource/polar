import re
from typing import TYPE_CHECKING

import anyio

from polar.config import settings

if TYPE_CHECKING:
    from .schemas import Email


def _transform_avatar_urls_for_email(props_json: str) -> str:
    """Transform logo.dev avatar URLs to use monogram fallback instead of 404."""
    return re.sub(
        r'(https://img\.logo\.dev/[^"]*?)fallback=404',
        r"\1fallback=monogram",
        props_json,
    )


async def render_from_json(template: str, props_json: str) -> str:
    process = await anyio.run_process(
        [
            settings.EMAIL_RENDERER_BINARY_PATH,
            template,
            props_json,
        ],
        check=False,
    )
    if process.returncode != 0:
        assert process.stderr is not None
        raise Exception(
            f"Error in react-email process: {process.stderr.decode('utf-8')}"
        )
    assert process.stdout is not None
    return process.stdout.decode("utf-8")


def serialize_email_props(email: "Email") -> str:
    props_json = email.props.model_dump_json()
    return _transform_avatar_urls_for_email(props_json)


async def render_email_template(email: "Email") -> str:
    return await render_from_json(email.template, serialize_email_props(email))


__all__ = ["render_email_template", "render_from_json", "serialize_email_props"]
