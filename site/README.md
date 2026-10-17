# Plouto Website

Minimal static site with privacy policy for App Store submission.

## Quick Deploy

**GitHub Pages:**
```bash
cd site
git init
git add .
git commit -m "Initial deploy"
git branch -M gh-pages
git remote add origin https://github.com/your-username/plouto-site.git
git push -u origin gh-pages
```
Then enable Pages in repo settings → Source: `gh-pages` / root.

**Netlify / Vercel:** drag the `site` folder onto the dashboard.

## Required Before Deploy

1. Edit `index.html`:
   - Replace `YOUR_APP_ID` in the App Store link with your actual App Store Connect ID.
   - Update `privacy@plouto.app` to your real contact email.
   - Update GitHub link in footer.

2. The privacy policy is at `/#privacy-policy` (in-page anchor) — App Store Connect accepts this.

## Files

```
site/
├── index.html      # Landing + privacy policy (single page)
├── package.json    # Dev scripts
└── README.md       # This file
```

No build step — pure HTML/CSS. Works on GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.