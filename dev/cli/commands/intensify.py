# hi haters

import math
import random
import subprocess
import tempfile
import unicodedata
from collections import defaultdict
from itertools import product
from pathlib import Path
from typing import Annotated

import typer
from PIL import Image, ImageOps

from shared import check_command_exists, console

SIZE = 128
DELTA = 6
FRAMES = 20
MAX_ROTATION = 15
SPIN_ZOOM = 1.3
MAX_GIF_BYTES = 128 * 1024

RENDER_EMOJI_SWIFT = """
import Cocoa
let emoji = CommandLine.arguments[1]
let output = CommandLine.arguments[2]
let size = NSSize(width: 128, height: 128)
let image = NSImage(size: size)
image.lockFocus()
let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 109)]
let str = emoji as NSString
let strSize = str.size(withAttributes: attrs)
str.draw(
  at: NSPoint(x: (size.width - strSize.width) / 2, y: (size.height - strSize.height) / 2),
  withAttributes: attrs
)
image.unlockFocus()
let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: output))
"""


def _render_emoji(emoji: str) -> Image.Image:
    if not check_command_exists("swift"):
        console.print(
            "[red]Emoji input needs `swift` (macOS Xcode Command Line Tools).[/red]"
        )
        raise typer.Exit(1)
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "emoji.png"
        subprocess.run(
            ["swift", "-", emoji, str(png)],
            input=RENDER_EMOJI_SWIFT,
            text=True,
            check=True,
        )
        return Image.open(png).convert("RGBA")


def _canvas(source: Image.Image, grid: int) -> Image.Image:
    side = SIZE * grid + 2 * DELTA
    if grid > 1:
        return ImageOps.pad(source, (side, side), color=(0, 0, 0, 0))
    fitted = ImageOps.contain(source, (SIZE, SIZE))
    canvas = Image.new("RGBA", (side, side))
    canvas.paste(fitted, ((side - fitted.width) // 2, (side - fitted.height) // 2))
    return canvas


def _tile_frames(
    canvas: Image.Image, grid: int, spin: bool
) -> dict[tuple[int, int], list[Image.Image]]:
    side = canvas.width
    zoomed = canvas
    if spin and grid > 1:
        zoomed = canvas.resize((round(side * SPIN_ZOOM),) * 2)
    offset = (zoomed.width - side) // 2

    tiles = defaultdict(list)
    for n in range(FRAMES):
        frame = zoomed
        if spin:
            angle = MAX_ROTATION * math.sin(2 * math.pi * n / FRAMES)
            frame = zoomed.rotate(angle, resample=Image.Resampling.BICUBIC)
        frame = frame.crop((offset, offset, offset + side, offset + side))
        for row, col in product(range(grid), repeat=2):
            x = col * SIZE + random.randint(0, 2 * DELTA)
            y = row * SIZE + random.randint(0, 2 * DELTA)
            tiles[row, col].append(frame.crop((x, y, x + SIZE, y + SIZE)))
    return tiles


def _write_gif(
    frames: list[Image.Image], path: Path, duration_ms: int, colors: int
) -> None:
    transparent = colors - 1
    strip = Image.new("RGB", (SIZE, SIZE * len(frames)))
    for i, frame in enumerate(frames):
        strip.paste(frame.convert("RGB"), (0, SIZE * i))
    palette = strip.quantize(transparent)

    paletted = []
    for frame in frames:
        indexed = frame.convert("RGB").quantize(
            palette=palette, dither=Image.Dither.NONE
        )
        clear = frame.getchannel("A").point(lambda a: 255 * (a < 128))
        indexed.paste(transparent, mask=clear)
        indexed.info["transparency"] = transparent
        paletted.append(indexed)

    paletted[0].save(
        path,
        save_all=True,
        append_images=paletted[1:],
        duration=duration_ms,
        loop=0,
        disposal=2,
    )


def _save_gif(frames: list[Image.Image], path: Path, duration_ms: int) -> None:
    while True:
        for colors in (256, 192, 128, 96, 64, 48, 32, 16):
            _write_gif(frames, path, duration_ms, colors)
            if path.stat().st_size <= MAX_GIF_BYTES:
                return
        frames, duration_ms = frames[::2], duration_ms * 2


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def intensify(
        source: Annotated[
            str, typer.Argument(help="Image path, or an emoji like 🔥 (macOS only)")
        ],
        grid: Annotated[
            int,
            typer.Option("--grid", min=1, help="Split into an NxN grid of emojis"),
        ] = 1,
        spin: Annotated[
            bool, typer.Option("--spin", help="Wobble-rotate as well as shake")
        ] = False,
    ) -> None:
        """Make a :something-intensifies: Slack emoji GIF from an image or emoji."""
        path = Path(source).expanduser()
        if path.is_file():
            image = ImageOps.exif_transpose(Image.open(path)).convert("RGBA")
            name, out_dir = path.stem, path.parent
        elif source.isascii():
            console.print(f"[red]No such file: {source}[/red]")
            raise typer.Exit(1)
        else:
            image = _render_emoji(source)
            name = "-".join(
                unicodedata.name(char).lower().replace(" ", "-")
                for char in source
                if unicodedata.category(char) == "So"
            )
            name, out_dir = name or "emoji", Path.cwd()

        duration_ms = 33 if spin else 40
        tiles = _tile_frames(_canvas(image, grid), grid, spin)

        if grid == 1:
            gif = out_dir / f"{name}-intensifies.gif"
            _save_gif(tiles[0, 0], gif, duration_ms)
            console.print(f"[green]Created {gif}[/green]")
            return

        for (row, col), frames in tiles.items():
            _save_gif(
                frames, out_dir / f"{name}-intensifies-r{row}c{col}.gif", duration_ms
            )
        console.print(
            f"[green]Created {grid}x{grid} grid in {out_dir.resolve()}[/green]"
        )
        console.print("Upload to Slack and paste in this order:\n")
        for row in range(grid):
            console.print(
                "  "
                + " ".join(f":{name}-intensifies-r{row}c{col}:" for col in range(grid)),
                emoji=False,
            )


# by haters
