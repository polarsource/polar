#!/usr/bin/env python3
"""
Extract and lint SQL from Tinybird .pipe files.

This script extracts SQL queries from Tinybird .pipe files (which contain SQL
after "SQL >" markers) and runs SQLFluff on them.
"""

import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List, Tuple


def extract_sql_from_pipe(file_path: Path) -> str | None:
    """
    Extract SQL content from a Tinybird .pipe file.

    Args:
        file_path: Path to the .pipe file

    Returns:
        Extracted SQL content or None if no SQL found
    """
    content = file_path.read_text()

    # Look for SQL after "SQL >" marker
    sql_match = re.search(r"SQL\s*>\s*\n(.*?)(?:\n\nTYPE|\Z)", content, re.DOTALL)

    if sql_match:
        sql_content = sql_match.group(1).strip()
        return sql_content

    return None


def lint_sql_content(sql_content: str, original_file: Path, config_path: Path) -> Tuple[int, str]:
    """
    Lint SQL content using SQLFluff.

    Args:
        sql_content: SQL content to lint
        original_file: Original file path (for reporting)
        config_path: Path to .sqlfluff config file

    Returns:
        Tuple of (exit_code, output)
    """
    # Create a temporary file with the SQL content
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as tmp:
        tmp.write(sql_content)
        tmp_path = tmp.name

    try:
        # Run SQLFluff on the temporary file
        result = subprocess.run(
            ["sqlfluff", "lint", tmp_path, "--config", str(config_path)],
            capture_output=True,
            text=True,
        )

        # Replace temp file path with original file path in output
        output = result.stdout.replace(tmp_path, str(original_file))

        return result.returncode, output
    finally:
        # Clean up temp file
        Path(tmp_path).unlink(missing_ok=True)


def main() -> int:
    """Main entry point."""
    # Find tinybird directory
    script_dir = Path(__file__).parent
    tinybird_dir = script_dir.parent / "tinybird"
    config_path = script_dir.parent / ".sqlfluff"

    if not tinybird_dir.exists():
        print(f"Error: Tinybird directory not found at {tinybird_dir}", file=sys.stderr)
        return 1

    if not config_path.exists():
        print(f"Error: .sqlfluff config not found at {config_path}", file=sys.stderr)
        return 1

    # Find all .pipe files
    pipe_files = list(tinybird_dir.rglob("*.pipe"))

    if not pipe_files:
        print("No .pipe files found in tinybird directory")
        return 0

    print(f"Found {len(pipe_files)} .pipe files to lint\n")

    all_passed = True
    results: List[Tuple[Path, int, str]] = []

    # Process each pipe file
    for pipe_file in sorted(pipe_files):
        sql_content = extract_sql_from_pipe(pipe_file)

        if sql_content is None:
            print(f"⚠️  {pipe_file.relative_to(tinybird_dir.parent)}: No SQL found")
            continue

        exit_code, output = lint_sql_content(sql_content, pipe_file, config_path)
        results.append((pipe_file, exit_code, output))

        if exit_code != 0:
            all_passed = False

    # Print results
    print("\n" + "=" * 80)
    print("SQLFluff Linting Results")
    print("=" * 80 + "\n")

    for pipe_file, exit_code, output in results:
        rel_path = pipe_file.relative_to(tinybird_dir.parent)
        if exit_code == 0:
            print(f"✓ {rel_path}: PASS")
        else:
            print(f"✗ {rel_path}: FAIL")
            print(output)
            print()

    # Summary
    passed = sum(1 for _, code, _ in results if code == 0)
    failed = len(results) - passed
    print(f"\nSummary: {passed} passed, {failed} failed out of {len(results)} files")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
