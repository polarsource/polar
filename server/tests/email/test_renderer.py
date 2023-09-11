from polar.email.renderer import EmailRenderer

email_renderer = EmailRenderer()


def test_render_from_string() -> None:
    subject = "Hello, {{ name }}!"
    body = "<p>Hi, {{ name }}! Welcome to Polar!</p>"

    rendered_subject, rendered_body = email_renderer.render_from_string(
        subject, body, context={"name": "John"}
    )

    assert rendered_subject == "Hello, John!"
    assert rendered_body.startswith("<!DOCTYPE html")
    assert "<p>Hi, John! Welcome to Polar!</p>" in rendered_body
