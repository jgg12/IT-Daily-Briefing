// scripts/build-news.mjs
// Fetches the RSS/Atom feeds listed in config/categories.json and writes
// data/news.json. Runs in GitHub Actions every morning. Unavailable feeds are
// skipped silently (a note goes to the Action log only). No credentials needed.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('config/categories.json', root), 'utf8'));

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();
const cutoff = now - config.windowDays * DAY_MS;
const FUTURE_TOLERANCE_MS = 60 * 60 * 1000; // ignore items dated more than 1 hour ahead

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const text = (v) => String((v !== null && typeof v === 'object' ? v['#text'] : v) ?? '').replace(/\s+/g, ' ').trim();

function parseFeed(xml) {
  const doc = parser.parse(xml);
  if (doc.rss) {
    return asArray(doc.rss.channel?.item).map((i) => ({
      title: text(i.title),
      url: text(i.link),
      date: text(i.pubDate ?? i['dc:date']),
    }));
  }
  if (doc.feed) {
    return asArray(doc.feed.entry).map((e) => {
      const links = asArray(e.link);
      const alt = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
      return { title: text(e.title), url: alt?.['@_href'] ?? '', date: text(e.published ?? e.updated) };
    });
  }
  if (doc['rdf:RDF']) {
    return asArray(doc['rdf:RDF'].item).map((i) => ({
      title: text(i.title),
      url: text(i.link),
      date: text(i['dc:date']),
    }));
  }
  return [];
}

// Normalized key used to remove duplicates across categories.
export function urlKey(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function isUsable(item) {
  const t = Date.parse(item.date);
  return (
    item.title &&
    /^https?:\/\//i.test(item.url) &&
    !item.url.toLowerCase().includes('/events/') &&
    Number.isFinite(t) &&
    t >= cutoff &&
    t <= now + FUTURE_TOLERANCE_MS
  );
}

async function fetchSource(source) {
  if (!source.url || source.url.startsWith('[PLACEHOLDER')) return [];
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'it-daily-briefing (Penn State; private news feed)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseFeed(await res.text());
  } catch (err) {
    console.warn(`Skipped ${source.name ?? source.url}: ${err.message}`);
    return [];
  }
}

const seen = new Set();
const items = [];

// Categories are processed in dropdown order, so the first category wins duplicates.
for (const category of config.categories) {
  if (category.type !== 'feed') continue;
  const fetched = (await Promise.all((category.sources ?? []).map(fetchSource))).flat();
  const kept = fetched
    .filter(isUsable)
    .map((i) => ({ ...i, date: new Date(Date.parse(i.date)).toISOString() }))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .filter((i) => {
      const key = urlKey(i.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, config.filteredLimit)
    .map((i) => ({ date: i.date, title: i.title, url: i.url, category: category.name }));
  items.push(...kept);
}

await mkdir(new URL('data/', root), { recursive: true });
await writeFile(
  new URL('data/news.json', root),
  JSON.stringify({ generated: new Date(now).toISOString(), items }, null, 2) + '\n'
);
console.log(`Wrote ${items.length} articles to data/news.json`);
