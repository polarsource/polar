def get_cents_in_dollar_string(cents: int) -> str:
    dollars = cents / 100
    if cents % 100 == 0:
        return str(round(dollars))
    return f"{round(dollars, 2):.2f}"
