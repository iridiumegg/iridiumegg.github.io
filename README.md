# iridiumegg.github.io

Personal portfolio / resume site for **Nathan Stewart** — Controls Engineer & Projects Manager.

Live at **https://iridiumegg.github.io**

## Stack

- Static HTML / CSS / vanilla JS — no build step
- [Lenis](https://github.com/darkroomengineering/lenis) (CDN) for smooth scrolling
- Google Fonts: Syne + DM Mono
- Deployed via GitHub Pages from the `main` branch

## Local preview

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Editing content

Everything lives in three files:

- `index.html` — all content (hero, work, experience, capabilities, contact)
- `css/style.css` — colors and layout; palette is defined in `:root` at the top
- `js/main.js` — smooth scroll, reveal animations, nav state
