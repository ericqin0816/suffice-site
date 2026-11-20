# Suffice website

Static site, no build step: `index.html`, `download.html`, `assets/styles.css`, `assets/main.js`, `assets/logo.svg`.

- Run locally: `python -m http.server 5173` then open http://localhost:5173
- Release URLs, version, install commands, links, contact email and waitlist endpoint all live in the `CONFIG` block at the top of `assets/main.js`.
- Check JS syntax: `node --check assets/main.js`
- Copy rule: only publish claims backed by real results; label experiments, small samples and unreleased products as such.
