from rich.text import Text

from shared import console

LOGOMARK = (
    "         ▄▄▄████████▄▄▄",
    "      ▄███▀████▀▀████████▄",
    "    ▄███▀▄███▀    ▀███ ▀███▄",
    "  ▄███▀▄██▄█▀      ▀███ ▀████▄",
    " ▄██▀ ▄██ ██        ███  ██▄▀█▄",
    " ███ ▄██ ██          ██▄ ▀██ ██",
    "███  ██  ██          ███  ██  ██",
    "██▀ ███  ██          ███ ███  ██",
    "██  ███  ██          ██  ███ ▄██",
    "██  ██▀ ███          ██  ██  ███",
    " ██ ███  ██          ██ ██▀ ███▀",
    " ▀█▄▀██  ███        ██ ██▀ ▄██▀",
    "  ▀█▄██▄ ███▄      ▄█▀██▀ ███▀",
    "    ▀███▄ ███▄    ▄███▀ ▄██▀",
    "      ▀████████▄▄▄███▄███▀",
    "         ▀▀█████████▀▀▀",
)
LOGOMARK_WIDTH = max(len(line) for line in LOGOMARK)


def print_banner(title: str, subtitle: str) -> None:
    middle = len(LOGOMARK) // 2
    captions = {middle - 1: Text(title, style="bold"), middle: Text(subtitle, style="dim")}
    console.print("\n")
    for index, line in enumerate(LOGOMARK):
        row = Text(line)
        if index in captions:
            row.pad_right(LOGOMARK_WIDTH + 4 - len(line))
            row.append_text(captions[index])
        console.print(row)
    console.print("\n")
