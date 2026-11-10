# Instructional Technology Daily Briefing: news feed

A private news feed for an Instructional Technology Specialist at Penn State.
It refreshes every morning at 5:00 AM Eastern and is hosted on **private**
GitHub Pages (only people with read access to the repo can open it).

## How it works

| Part | What it does |
| --- | --- |
| `config/categories.json` | Category order, feed sources, link-only destinations, and the display limits. |
| `scripts/build-news.mjs` | Fetches the RSS/Atom feeds and writes `data/news.json`. Runs in GitHub Actions. |
| `data/teams.json` | Recent Campus IDs › General posts. Written by a Claude scheduled task through the Microsoft 365 connector. See `docs/teams-refresh-task.md`. |
| `index.html`, `app.js`, `styles.css` | The page. Merges both data files and applies the display rules. |
| `.github/workflows/refresh.yml` | Builds and deploys at 5:00 AM Eastern and on every push to `main`. |

No usernames, passwords, tokens, or API keys are stored anywhere in this repo.

## Display rules

- Dropdown order: All Categories (default), Service Status, Ed Tech,
  Instructional Design, AI, Multimedia, System Admin, CMS, LMS, Accessibility.
- **Service Status** (ServiceNow) and **Accessibility** (Accessibility (Web)
  Liaisons Teams channel) are link-only: they open their destination and never
  change the list. Their messages are never scraped or extracted.
- **Instructional Design** shows Campus IDs Teams posts plus a link to the
  channel. **Multimedia** shows its news plus a separate Teams channel link.
- Default view: the 10 newest items overall, sorted by date only, max 3 per
  category. Filtered view: up to 10 items from that category.
- 7-day window, no URLs containing `/events/`, duplicates removed (first
  category in dropdown order wins).
- Each item: `Date — Linked Title`. Empty result: "No new updates in the past 7 days."

## Still needed

- [ ] Feed sources for Ed Tech, AI, Multimedia (H5P), System Admin, CMS, and LMS.
      Add them to `config/categories.json`, for example:
      `"sources": [{ "name": "[PLACEHOLDER: source name]", "url": "[PLACEHOLDER: RSS or Atom URL]" }]`
- [ ] Service Status (ServiceNow) and Multimedia Teams channel URLs. Each is
      marked `[PLACEHOLDER]` in `config/categories.json`.
- [ ] Project reference files: News Feed Rules, Technical Standards (and, for the
      briefing, Airtable Schema, Daily Briefing Format, Weekly Report Format).
- [ ] "Penn State System" design system. Colors are tokens in `styles.css`, ready to swap.

## Preview locally

```bash
cd ~/Code/IT-Daily-Briefing
npm install
npm run build:news   # optional: fetch feeds into data/news.json
npm run preview      # then open http://localhost:8080
```

## Publish (one time)

1. Create a **private** repo under psu-cei, then push this folder to `main`.
2. Settings → Pages: Source **GitHub Actions**, visibility **Private**.
3. Create the Claude scheduled task in `docs/teams-refresh-task.md`.
