# Emails 📬

This package contains all the email templates used by the server, implemented through [`react-email`](https://react.email).

## Development

Install the dependencies:

```bash
pnpm install
```

Run the react-email development server:

```bash
pnpm dev
```

This will start a development server at [http://localhost:3000](http://localhost:3000) that will automatically update as you make changes to the email templates.

## How to create a new email?

1. Create a new TSX file in the `src/emails` directory with the name of the email template, as snake case, e.g. `magic_link.tsx`.
2. Implement the email template using the `react-email` components.
3. Make sure the props are JSON serializable.

## How to render it from the Python server?

First, you'll need to build the email templates:

```bash
uv run task emails
```

Then, use the `render_email_template` function:

```python
from polar.email.react import render_email_template

body = render_email_template("magic_link", {
    "token_lifetime_minutes": 30,
    "url": "https://example.com",
})
```

The first argument is the name of the email template, and the second argument is a dictionary with the props the email template expects.

## How does it work?

This project entrypoint is actually a CLI tool accepting the name of the email template to render and the props to pass to it.

When building the project, we generate a full NodeJS binary with all our scripts bundled. This magic trick is allowed by [@yao-pkg/pkg](https://github.com/yao-pkg/pkg).

By doing this, we only have to bundle a single binary file in our Python server which we can simply call using `subprocess`.
