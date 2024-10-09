#! /usr/bin/env -S uv run
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "authlib",
#     "httpx",
#     "python-dotenv",
#     "yaspin",
# ]
# ///
import argparse
import functools
import http.server
import json
import os
import pathlib
import queue
import random
import string
import typing
import urllib.parse
import webbrowser

import httpx
from authlib.jose import JsonWebKey, KeySet
from dotenv import dotenv_values
from yaspin import yaspin
from yaspin.spinners import Spinners

ROOT_PATH = pathlib.Path(__file__).parent.parent
IS_CODESPACES = os.getenv("CODESPACES", "false") == "true"
SETUP_PAGE = """
<form id="setup-form" action="https://github.com/organizations/polarsource/settings/apps/new" method="post">
 Register a GitHub App Manifest: <input type="text" name="manifest" id="manifest"><br>
 <input type="submit" value="Submit">
</form>

<script>
    input = document.getElementById("manifest")
    input.value = '{manifest}'
    document.addEventListener("DOMContentLoaded", function() {{
        document.getElementById("setup-form").submit()
    }});
</script>
"""

CALLBACK_ERROR_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <title>GitHub App Setup</title>
</head>
<body>
    <h1>GitHub App Setup</h1>
    <p>Failed to setup the GitHub App</p>
    <p>Params: {params}</p>
</body>
</html>
"""

CALLBACK_SUCCESS_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <title>GitHub App Setup</title>
</head>
<body>
    <h1>GitHub App Setup</h1>
    <p>GitHub App has been successfully setup</p>
    <p>You can close this page now</p>
    <script>
        document.addEventListener("DOMContentLoaded", function() {{
            setTimeout(function() {{
                window.close()
            }}, 5000)
        }});
    </script>
</body>
</html>
"""


def _get_github_app_manifest(
    app_name: str, backend_external_url: str, setup_base_url: str
) -> dict[str, typing.Any]:
    return {
        "name": app_name[:32],
        "url": backend_external_url,
        "hook_attributes": {
            "url": f"{backend_external_url}/v1/integrations/github/webhook",
        },
        "callback_urls": [
            f"{backend_external_url}/v1/integrations/github/callback",
            f"{backend_external_url}/v1/integrations/github_repository_benefit/user/callback",
        ],
        "redirect_url": f"{setup_base_url}/callback",
        "public": False,
        "default_permissions": {
            # GitHub Issue Funding app
            "issues": "write",
            "pull_requests": "write",
            "members": "read",
            "organization_events": "read",
            "emails": "read",
            # GitHub Repository Benefit app
            "administration": "write",
            "organization_plan": "read",
            "plan": "read",
        },
        "default_events": [
            "issues",
            "issue_comment",
            "label",
            "public",
            "repository",
            "milestone",
        ],
    }


class SetupGitHubAppHTTPServer(http.server.ThreadingHTTPServer):
    pass


class SetupGitHubAppHTTPRequestHandler(http.server.BaseHTTPRequestHandler):
    def __init__(
        self,
        *args,
        queue: "queue.Queue[str]",
        manifest: dict[str, typing.Any],
        **kwargs,
    ) -> None:
        self.queue = queue
        self.manifest = manifest
        super().__init__(*args, **kwargs)

    def log_message(self, format: str, *args: typing.Any) -> None:
        pass

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_url.query)

        if parsed_url.path == "/setup":
            self.handle_setup()
        elif parsed_url.path == "/callback":
            self.handle_callback(parsed_url, query_params)
        else:
            output = b"Not found"
            self.send_response(http.HTTPStatus.NOT_FOUND)
            self.send_header("Content-type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(output)))
            self.end_headers()
            self.wfile.write(output)

    def handle_setup(self):
        output = SETUP_PAGE.format(manifest=json.dumps(self.manifest)).encode("utf-8")
        self.send_response(http.HTTPStatus.OK)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(output)))
        self.end_headers()
        self.wfile.write(output)

    def handle_callback(
        self, url: urllib.parse.ParseResult, query_params: dict[typing.Any, list]
    ) -> None:
        try:
            code = query_params["code"][0]
        except (KeyError, IndexError):
            output = CALLBACK_ERROR_PAGE.format(params=query_params).encode("utf-8")
            self.send_response(http.HTTPStatus.BAD_REQUEST)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(output)))
            self.end_headers()
            self.wfile.write(output)
        else:
            self.queue.put(code)

            output = CALLBACK_SUCCESS_PAGE.encode("utf-8")
            self.send_response(http.HTTPStatus.OK)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(output)))
            self.end_headers()
            self.wfile.write(output)

        self.server.shutdown()


def _get_github_app_code(port: int, manifest: dict[str, typing.Any]) -> str:
    code_queue: queue.Queue[str] = queue.Queue()
    server = SetupGitHubAppHTTPServer(
        ("localhost", port),
        functools.partial(
            SetupGitHubAppHTTPRequestHandler,
            manifest=manifest,
            queue=code_queue,
        ),
    )
    server.serve_forever()
    return code_queue.get(block=False)


def _register_github_app(code: str) -> dict[str, typing.Any]:
    response = httpx.post(f"https://api.github.com/app-manifests/{code}/conversions")
    response.raise_for_status()
    return response.json()


def _write_env_file(
    template_file_path: pathlib.Path,
    env_file_path: pathlib.Path,
    replacements: dict[str, str],
) -> None:
    with open(env_file_path, "w") as env_file:
        template_env = dotenv_values(template_file_path)
        for key, value in template_env.items():
            output_value = replacements.get(key, value)
            delimiter = "'" if '"' in str(output_value) else '"'
            env_file.write(f"{key}={delimiter}{output_value}{delimiter}\n")


def _write_server_env_file(github_app: dict[str, typing.Any] | None = None) -> None:
    template_file_path = ROOT_PATH / "server" / ".env.template"
    env_file_path = ROOT_PATH / "server" / ".env"
    replacements: dict[str, str] = {}
    if IS_CODESPACES:
        replacements = {
            **replacements,
            "POLAR_ALLOWED_HOSTS": json.dumps(
                [
                    f"{os.environ['CODESPACE_NAME']}-8080.{os.environ['GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN']}",
                    "localhost:3000",
                    "127.0.0.1:3000",
                ]
            ),
            "POLAR_FRONTEND_BASE_URL": f"https://{os.environ['CODESPACE_NAME']}-8080.{os.environ['GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN']}",
            "POLAR_AUTH_COOKIE_DOMAIN": f"{os.environ['CODESPACE_NAME']}-8080.{os.environ['GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN']}",
        }
    if github_app is not None:
        replacements = {
            **replacements,
            "POLAR_GITHUB_APP_NAMESPACE": github_app["slug"],
            "POLAR_GITHUB_CLIENT_ID": github_app["client_id"],
            "POLAR_GITHUB_CLIENT_SECRET": github_app["client_secret"],
            "POLAR_GITHUB_APP_WEBHOOK_SECRET": github_app["webhook_secret"],
            "POLAR_GITHUB_APP_IDENTIFIER": github_app["id"],
            "POLAR_GITHUB_APP_PRIVATE_KEY": github_app["pem"],
            "POLAR_GITHUB_REPOSITORY_BENEFITS_APP_NAMESPACE": github_app["slug"],
            "POLAR_GITHUB_REPOSITORY_BENEFITS_APP_IDENTIFIER": github_app["id"],
            "POLAR_GITHUB_REPOSITORY_BENEFITS_APP_PRIVATE_KEY": github_app["pem"],
            "POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_ID": github_app["client_id"],
            "POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET": github_app[
                "client_secret"
            ],
        }
    _write_env_file(template_file_path, env_file_path, replacements)


def _write_apps_web_env_file(github_app: dict[str, typing.Any] | None = None) -> None:
    template_file_path = ROOT_PATH / "clients" / "apps" / "web" / ".env.template"
    env_file_path = ROOT_PATH / "clients" / "apps" / "web" / ".env.local"
    replacements: dict[str, str] = {}
    if IS_CODESPACES:
        replacements = {
            **replacements,
            "NEXT_PUBLIC_API_URL": f"https://{os.environ['CODESPACE_NAME']}-8080.{os.environ['GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN']}",
            "NEXT_PUBLIC_FRONTEND_BASE_URL": f"https://{os.environ['CODESPACE_NAME']}-8080.{os.environ['GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN']}",
        }
    if github_app is not None:
        replacements = {
            **replacements,
            "NEXT_PUBLIC_GITHUB_APP_NAMESPACE": github_app["slug"],
        }
    _write_env_file(template_file_path, env_file_path, replacements)


def _generate_jwks() -> None:
    options = {"kid": "polar_dev", "use": "sig"}
    key = JsonWebKey.generate_key("RSA", 2048, options, is_private=True)
    keyset = KeySet(keys=[key])
    json_keyset = keyset.as_json(is_private=True)
    with open(ROOT_PATH / "server" / ".jwks.json", "w") as jwks_file:
        jwks_file.write(json_keyset)


def _get_options():
    if IS_CODESPACES:
        default_backend_external_url = f"https://{os.environ['CODESPACE_NAME']}-8080.{os.environ['GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN']}"
        default_github_app_name = f"polar-{os.environ['CODESPACE_NAME']}"
        default_github_setup_base_url = f"https://{os.environ['CODESPACE_NAME']}-51562.{os.environ['GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN']}"
    else:
        default_backend_external_url = None
        default_github_app_name = (
            f"polar-development-{''.join(random.choices(string.ascii_lowercase, k=8))}"
        )
        default_github_setup_base_url = "http://localhost:51562"

    parser = argparse.ArgumentParser(
        description="Setup the environment files for Polar development"
    )
    parser.add_argument(
        "--setup-github-app",
        action="store_true",
        help="Whether to setup the GitHub App",
    )
    parser.add_argument(
        "--backend-external-url",
        type=str,
        help="The Polar backend base URL, available externally.",
        default=default_backend_external_url,
        required=False,
    )
    parser.add_argument(
        "--github-app-name",
        type=str,
        help="The name of the Polar backend app",
        default=default_github_app_name,
    )
    parser.add_argument(
        "--github-setup-port",
        type=int,
        help="The port on which to open the temporary webserver to create GitHub app",
        default=51562,
    )
    parser.add_argument(
        "--github-setup-base-url",
        type=str,
        help="The base URL of the temporary webserver to create GitHub app",
        default=default_github_setup_base_url,
    )

    args = parser.parse_args()

    if args.setup_github_app and args.backend_external_url is None:
        parser.error(
            "--backend-external-url is required when --setup-github-app is set"
        )

    return args


if __name__ == "__main__":
    options = _get_options()
    with yaspin(
        text="Setting up environment files...",
        spinner=Spinners.dots,
    ) as spinner:
        github_app = None
        if options.setup_github_app:
            manifest = _get_github_app_manifest(
                options.github_app_name,
                options.backend_external_url,
                options.github_setup_base_url,
            )
            spinner.text = f"Open {options.github_setup_base_url}/setup in your browser to setup the GitHub App"
            webbrowser.open(f"{options.github_setup_base_url}/setup")
            code = _get_github_app_code(options.github_setup_port, manifest)
            spinner.text = "Registering the GitHub App..."
            github_app = _register_github_app(code)
        spinner.text = "Writing environment files..."
        _write_server_env_file(github_app)
        _write_apps_web_env_file(github_app)
        _generate_jwks()
        spinner.ok("Environment files have been successfully setup")
