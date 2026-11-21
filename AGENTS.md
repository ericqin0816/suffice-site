# Suffice website

Static site, no build step: `index.html`, `download.html`, `assets/styles.css`, `assets/main.js`, `assets/logo.svg`.

- Run locally: `python -m http.server 5173` then open http://localhost:5173
- Release URLs, version, install commands, links, contact email and waitlist endpoint all live in the `CONFIG` block at the top of `assets/main.js`.
- Check JS syntax: `node --check assets/main.js`
- Copy rule: only publish claims backed by real results; label experiments, small samples and unreleased products as such.
- `v2/` is a second, self-contained design with its own pixel identity: notched pixel corners, bevel buttons, dot-grid background, `[ bracket ]` labels, dithered scenes that resolve from chunky to fine, an "enough" meter, Inter + Silkscreen. It has its own `v2/main.js` CONFIG block. Don't copy other sites' layouts; take inspiration only.
- Hosted on GitHub Pages from `main`: https://ericqin0816.github.io/suffice-site/ (v2 at `/v2/`). Push to `main` to deploy.
- Visual checks: headless Chrome is more reliable than Edge here, e.g. `chrome.exe --headless=new --user-data-dir=<tmp> --force-prefers-reduced-motion --window-size=1440,7600 --screenshot=<file> <url>`.
