def search_query(text: str) -> str:
    # cleanup search query
    text = (
        text.replace(":", "")
        .replace("*", "")
        .replace("|", "")
        .replace("<", "")
        .replace(">", "")
        .replace("!", "")
        .replace(")", "")
        .replace("(", "")
        .replace("'", "")
        .replace("&", "")
        .replace("/", "")
        .replace(" OR ", "")
        .replace(" AND ", "")
    )

    # Search in titles using the vector index
    # https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-PARSING-QUERIES
    #
    # The index supports fast matching of words and prefix-matching of words
    #
    # Here we're converting a user query like "feat cli" to
    # "feat:* | cli:*"
    words = text.split(" ")

    # remove empty words
    words = [w for w in words if len(w.strip()) > 0]

    # convert all words to prefix matches
    words = [f"{w}:*" for w in words]

    # OR all words
    return " | ".join(words)
