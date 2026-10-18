# Email assets

- `logo.png`: the existing Signal Garden double-arc logo and wordmark from `public/logo-email.png` (also in `/Users/rayn/signal-garden-posters/logo-transparent.png`), exported at 3× display size on the email header background.
- `x.png`, `xiaohongshu.png`: Simple Icons brand glyphs, sourced from `https://cdn.simpleicons.org/x/F2F0EA` and `https://cdn.simpleicons.org/xiaohongshu/F2F0EA` (CC0), exported on the email footer background.

PNG assets are used because inline SVG and SVG image support varies between mail clients. Ship this directory together with the email templates; production messages load these files from the configured HTTPS site origin.
