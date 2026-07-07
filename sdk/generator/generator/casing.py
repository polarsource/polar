def to_snake_case(name: str) -> str:
    """Convert a string to snake_case."""
    result = []
    for i, c in enumerate(name):
        if c == "-":
            result.append("_")
            continue
        if (
            c.isupper()
            and i > 0
            and name[i - 1] != "-"
            and (name[i - 1].islower() or (i + 1 < len(name) and name[i + 1].islower()))
        ):
            result.append("_")
        result.append(c.lower())
    return "".join(result)


def to_pascal_case(name: str) -> str:
    """Convert a string to PascalCase."""
    return "".join(word[:1].upper() + word[1:] for word in name.split("_") if word)


def to_camel_case(name: str) -> str:
    """Convert a string to camelCase."""
    # Handle both snake_case and PascalCase
    if "_" in name:
        # Convert from snake_case
        parts = name.split("_")
        return parts[0].lower() + "".join(
            word[:1].upper() + word[1:] for word in parts[1:] if word
        )
    else:
        # Convert from PascalCase
        if len(name) == 0:
            return name
        return name[0].lower() + name[1:]
