# Security policy

This is a read-only educational demonstration. Report suspected security issues privately using the repository owner's GitHub security reporting channel if enabled, or contact the maintainer without publishing exploit details.

## Boundaries

The app does not require accounts, collect personal information, or accept uploads. Speech data is stored locally and sentiment is computed server-side. The legacy /sentiment route is bounded to 500 characters and returns plain text. Run behind a production WSGI/HTTPS server when exposing it publicly; Flask's development server is for local use only. Set TRUSTED_HOSTS to the comma-separated public hostnames when deploying behind a trusted reverse proxy.

Third-party YouTube embedding sends traffic to YouTube only once its player is loaded. Content Security Policy allows the YouTube iframe API and privacy-enhanced youtube-nocookie.com player. Keep Python and GitHub Actions dependencies updated and check CI audits.
