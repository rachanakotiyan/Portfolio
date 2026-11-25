# Portfolio

A minimal, content-first portfolio built with Astro. Projects and writing live in Markdown files under `src/content/`; shared site details live in `src/data/site.ts`.

## Getting started

```sh
npm install
npm run dev
```

Use Node.js 22.23.4 or newer.

Run `npm run check` for diagnostics and `npm run build` to generate the static site in `dist/`.

Set `LASTFM_API_KEY` and `LASTFM_USERNAME` in your deployment environment to enable the lab's now-playing widget. The API route returns an unavailable state if these values are not configured.

Replace the sample content, links, and the `site` URL in `astro.config.mjs` before publishing. Replace `public/images/hero.svg` with your own hero art, add a social card at `public/images/og-image.jpg`, licensed self-hosted fonts under `public/fonts/`, and your PDF at `public/resume.pdf`.
