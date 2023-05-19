from polar.logging import configure as configure_logging
import polar.integrations.github.verify as github_verify


def main() -> None:
    configure_logging()
    github_verify.verify_app_configuration()
