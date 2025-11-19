import os
import subprocess
from typing import TYPE_CHECKING

from polar.config import settings

if TYPE_CHECKING:
    from .schemas import Email


def render_email_template(email: "Email") -> str:
    # Lightweight deployments (e.g. Vercel) can disable HTML email rendering
    # entirely by setting POLAR_DISABLE_EMAIL_RENDERING. In that case we just
    # return a simple placeholder HTML instead of calling the Node binary.
    if os.getenv("POLAR_DISABLE_EMAIL_RENDERING", "").lower() in ("1", "true", "yes"):
        return f"<html><body><pre>Email rendering is disabled.\nTemplate: {email.template}\nProps: {email.props.model_dump()}</pre></body></html>"

    process = subprocess.Popen(
        [
            settings.EMAIL_RENDERER_BINARY_PATH,
            email.template,
            email.props.model_dump_json(),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    stdout, stderr = process.communicate()
    if process.returncode != 0:
        raise Exception(f"Error in react-email process: {stderr.decode('utf-8')}")
    return stdout.decode("utf-8")


__all__ = ["render_email_template"]
