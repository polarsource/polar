---
'@polar-sh/cli': major
---

**API resources.** Manage your Polar data straight from the terminal: `polar customers`, `products`, `orders`, `subscriptions`, `checkouts`, `discounts`, `benefits`, `meters`, `webhooks` and more.

**`polar trigger`.** Send test webhook events to your app without creating anything real. Run `polar trigger --list` to see what's available.

**`polar listen`.** Forward webhooks to a port (`polar listen 3000`) or a URL and see how your server responded to each event. Use `polar listen --print-secret` to grab the signing secret for your `.env`.

**Auth.** `polar login` and `polar logout` are now `polar auth login` and `polar auth logout`. Use `polar auth whoami` to see who you're logged in as and `polar auth org` to switch organizations.

**Everything else.** Type `polar` to see your account and active org. Windows works without WSL. Install from npm with `npm install -g @polar-sh/cli`. Nicer output and error messages all round.
