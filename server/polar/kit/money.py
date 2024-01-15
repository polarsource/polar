def get_cents_in_dollar_string(cents: int) -> str:
    dollars = cents / 100
    if cents % 100 == 0:
        return "%d" % round(dollars)
    return "%.2f" % round(dollars, 2)
