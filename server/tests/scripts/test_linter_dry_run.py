import ast

from scripts.linters.dry_run import check

DB_SCRIPT = (
    "import typer\n"
    "from polar.kit.db.postgres import create_async_sessionmaker\n"
    "def main({parameters}) -> None: ...\n"
    'if __name__ == "__main__":\n'
    "    main()\n"
)


def test_flags_db_script_without_dry_run() -> None:
    tree = ast.parse(DB_SCRIPT.format(parameters="batch_size: int"))
    assert [lineno for lineno, _ in check(tree)] == [2]


def test_allows_dry_run_execute_and_commit() -> None:
    for parameter in ("dry_run", "execute", "commit"):
        tree = ast.parse(DB_SCRIPT.format(parameters=f"{parameter}: bool = False"))
        assert check(tree) == []


def test_ignores_modules_without_main_guard() -> None:
    tree = ast.parse("from scripts.helper import run_batched_update\n")
    assert check(tree) == []
