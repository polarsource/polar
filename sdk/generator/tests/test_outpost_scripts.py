import pathlib

import pytest

from generator import emitter


def test_loads_every_outpost_script() -> None:
    assert set(emitter.load_outpost_scripts()) == {
        "read_state",
        "write_bucket",
        "confirm",
        "apply_snapshot",
    }


@pytest.mark.parametrize("breaker", ["`", "${", '"""', "\\"])
def test_rejects_a_script_that_breaks_its_literal(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch, breaker: str
) -> None:
    (tmp_path / "script.lua").write_text(f"return '{breaker}'\n")
    monkeypatch.setattr(emitter, "OUTPOST_SCRIPTS_DIRECTORY", tmp_path)
    with pytest.raises(ValueError, match="script.lua"):
        emitter.load_outpost_scripts()
