from polar.kit.html import dangerously_strip_tags


def test_get_safe_return_url() -> None:
    assert dangerously_strip_tags("<strong>Hello World!</strong>") == "Hello World!"
    assert dangerously_strip_tags("<p>Cats!</p>") == "Cats!"
    assert dangerously_strip_tags("<p>Cats!<</p>") == "Cats!"
    assert dangerously_strip_tags("<<p>Cats!<</p>") == "Cats!"
    assert (
        dangerously_strip_tags("<strong>Hello World!<p></strong>Yikkedi yakkedi</p>")
        == "Hello World!Yikkedi yakkedi"
    )

    assert (
        dangerously_strip_tags("""<html/><bo/dy>This is some <i>rather</i><b
>
large<>string<br/> of<i> HTML<img src="https://example.com">


<body></head><html/>""")
        == """This is some rather
largestring of HTML


"""
    )
