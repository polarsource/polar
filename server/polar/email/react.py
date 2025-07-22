import json
import subprocess

from polar.config import settings

# Disallow `None` as that would show up as `null` in the eamil
type JSONProperty = str | int | dict[str, "JSONProperty"] | list["JSONProperty"]


def render_email_template(template: str, props: dict[str, JSONProperty]) -> str:
    process = subprocess.Popen(
        [settings.EMAIL_RENDERER_BINARY_PATH, template, json.dumps(props)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    stdout, stderr = process.communicate()
    if process.returncode != 0:
        raise Exception(f"Error in react-email process: {stderr.decode('utf-8')}")
    return stdout.decode("utf-8")


__all__ = ["render_email_template"]
