import functools
import shutil
from pathlib import Path

_POLICY_PATH = Path(__file__).parent / "acceptable-use-policy.mdx"


@functools.cache
def fetch_policy_content() -> str:
    if not _POLICY_PATH.exists():
        raise FileNotFoundError(f"AUP file does not exist: {_POLICY_PATH}.")
    if not _POLICY_PATH.is_file():
        raise FileNotFoundError(f"AUP path is not a file: {_POLICY_PATH}.")
    return _POLICY_PATH.read_text(encoding="utf-8")


if __name__ == "__main__":
    """
    Copy the AUP source file from the legal to the server directory.

    Run it using: `uv run -m polar.organization_review.policy`
    """
    root_path = Path(__file__).parent.parent.parent.parent
    source_file_path = (
        root_path
        / "clients"
        / "apps"
        / "web"
        / "src"
        / "app"
        / "(main)"
        / "(website)"
        / "(landing)"
        / "(mdx)"
        / "legal"
        / "acceptable-use-policy"
        / "page.mdx"
    )
    if not source_file_path.exists():
        raise FileNotFoundError(f"Source AUP file does not exist: {source_file_path}")
    if not source_file_path.is_file():
        raise FileNotFoundError(f"Source AUP path is not a file: {source_file_path}")
    shutil.copy(source_file_path, _POLICY_PATH)
