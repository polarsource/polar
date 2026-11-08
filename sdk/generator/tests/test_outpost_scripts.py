import pathlib

import pytest

from generator import emitter


def test_loads_every_outpost_script() -> None:
    assert set(emitter.load_outpost_scripts()) == {
        "read_state",
        "write_bucket",
        "confirm",
        "apply_snapshot",
        "commit_pull",
        "backoff",
        "release_lock",
        "extend_lock",
    }


@pytest.mark.parametrize("breaker", ["`", "${", '"""', "\\"])
def test_rejects_a_script_that_breaks_its_literal(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch, breaker: str
) -> None:
    (tmp_path / "script.lua").write_text(f"return '{breaker}'\n")
    monkeypatch.setattr(emitter, "OUTPOST_SCRIPTS_DIRECTORY", tmp_path)
    with pytest.raises(ValueError, match="script.lua"):
        emitter.load_outpost_scripts()


def test_every_sdk_renders_every_outpost_constant() -> None:
    root = pathlib.Path(emitter.__file__).parent.parent
    templates = {
        "typescript": ("src/outpost/client.ts", "src/outpost/reducer.ts"),
        "python": ("polar/outpost/client.py", "polar/outpost/reducer.py"),
    }
    for language, paths in templates.items():
        source = "".join(
            (root / language / "template" / path).read_text() for path in paths
        )
        for name in emitter.load_outpost_constants():
            assert f"outpost_constants.{name} " in source, (language, name)
