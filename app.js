// app.js
// Renders the news list from data/news.json (web feeds) and data/teams.json
// (Campus IDs Teams posts, written by a Claude scheduled task). All display rules
// from the News Feed Rules live here.

(() => {
  'use strict';

  const ALL = 'All Categories';
  const DAY_MS = 24 * 60 * 60 * 1000;
  const TEAMS_CATEGORY = 'Instructional Design';

  const els = {
    select: document.getElementById('category'),
    list: document.getElementById('news'),
    empty: document.getElementById('empty'),
    status: document.getElementById('status'),
    updated: document.getElementById('updated'),
    channel: document.getElementById('channel-link'),
  };

  let config = null;
  let items = [];
  let current = ALL;

  const isPlaceholder = (url) => !url || String(url).startsWith('[PLACEHOLDER');

  // Teams links open straight in the Teams desktop app (msteams: protocol)
  // instead of a browser tab. Other links keep opening in a new tab.
  const TEAMS_HOSTS = ['teams.microsoft.com', 'teams.cloud.microsoft'];
  function teamsAppUrl(url) {
    try {
      const u = new URL(url);
      if (TEAMS_HOSTS.includes(u.hostname) && u.pathname.startsWith('/l/')) {
        return `msteams:${u.pathname}${u.search}`;
      }
    } catch { /* not a URL */ }
    return null;
  }

  // Sets href/target on a link: Teams links open the app, others a new tab.
  function setLink(a, url) {
    const app = teamsAppUrl(url);
    if (app) {
      a.href = app;
    } else {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    return Boolean(app);
  }

  async function loadJson(path) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      return res.ok ? await res.json() : null;
    } catch {
      return null; // unavailable sources are skipped silently
    }
  }

  function urlKey(url) {
    try {
      const u = new URL(url);
      u.hash = '';
      return u.toString().replace(/\/$/, '').toLowerCase();
    } catch {
      return String(url).trim().toLowerCase();
    }
  }

  function formatDate(iso) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: config.timeZone, month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(iso));
  }

  function formatUpdated(iso) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: config.timeZone, weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }).format(new Date(iso));
  }

  // Merge, filter to the 7-day window, drop /events/ URLs, and remove duplicates
  // (first category in dropdown order wins).
  function prepare(news, teams) {
    const order = config.categories.map((c) => c.name);
    const cutoff = Date.now() - config.windowDays * DAY_MS;
    const teamsItems = (teams?.items ?? []).map((i) => ({ ...i, category: TEAMS_CATEGORY }));
    const all = [...(news?.items ?? []), ...teamsItems].filter((i) => {
      const t = Date.parse(i.date);
      return i.title && /^https?:\/\//i.test(i.url) && !i.url.toLowerCase().includes('/events/')
        && Number.isFinite(t) && t >= cutoff && order.includes(i.category);
    });
    all.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
    const seen = new Set();
    return all.filter((i) => {
      const key = urlKey(i.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function byNewest(a, b) { return Date.parse(b.date) - Date.parse(a.date); }

  // Default view: 10 newest overall, max 3 per category, sorted only by date.
  function defaultView() {
    const counts = {};
    const out = [];
    for (const item of [...items].sort(byNewest)) {
      if ((counts[item.category] ?? 0) >= config.maxPerCategoryDefault) continue;
      counts[item.category] = (counts[item.category] ?? 0) + 1;
      out.push(item);
      if (out.length === config.defaultLimit) break;
    }
    return out;
  }

  function filteredView(name) {
    return items.filter((i) => i.category === name).sort(byNewest).slice(0, config.filteredLimit);
  }

  function renderChannelLink(category) {
    const link = category?.type === 'teams'
      ? { label: category.channelLabel, url: category.channelUrl }
      : category?.extraLink;
    els.channel.replaceChildren();
    if (!link) { els.channel.hidden = true; return; }
    if (isPlaceholder(link.url)) {
      els.channel.textContent = `${link.label}: link not set yet.`;
    } else {
      const a = document.createElement('a');
      const inApp = setLink(a, link.url);
      a.textContent = `${link.label} (${inApp ? 'opens in Teams' : 'opens in new tab'})`;
      els.channel.append(a);
    }
    els.channel.hidden = false;
  }

  function render() {
    const category = config.categories.find((c) => c.name === current);
    const list = current === ALL ? defaultView() : filteredView(current);
    renderChannelLink(category);

    els.list.replaceChildren(...list.map((item) => {
      const li = document.createElement('li');
      const time = document.createElement('time');
      time.dateTime = item.date;
      time.textContent = formatDate(item.date);
      const a = document.createElement('a');
      setLink(a, item.url);
      a.textContent = item.title;
      li.append(time, ' — ', a);
      return li;
    }));
    els.empty.hidden = list.length > 0;
  }

  function onChange() {
    const chosen = els.select.value;
    const category = config.categories.find((c) => c.name === chosen);

    // Link-only categories open their destination and never change the list.
    if (category?.type === 'link') {
      els.select.value = current;
      if (isPlaceholder(category.url)) {
        els.status.textContent = `The ${category.name} link is not set yet.`;
      } else {
        const app = teamsAppUrl(category.url);
        if (app) {
          window.location.href = app; // hands off to the Teams app; the page stays put
          els.status.textContent = `Opened ${category.name} in Teams.`;
        } else {
          window.open(category.url, '_blank', 'noopener');
          els.status.textContent = `Opened ${category.name} in a new tab.`;
        }
      }
      return;
    }

    current = chosen;
    els.status.textContent = '';
    render();
  }

  async function init() {
    const [cfg, news, teams] = await Promise.all([
      loadJson('config/categories.json'),
      loadJson('data/news.json'),
      loadJson('data/teams.json'),
    ]);
    if (!cfg) {
      els.updated.textContent = 'The feed settings could not be loaded.';
      return;
    }
    config = cfg;

    const names = [ALL, ...config.categories.map((c) => c.name)];
    els.select.replaceChildren(...names.map((name) => {
      const category = config.categories.find((c) => c.name === name);
      const opt = new Option(category?.type === 'link' ? `${name} (opens link)` : name, name);
      return opt;
    }));
    els.select.value = ALL;
    els.select.addEventListener('change', onChange);

    items = prepare(news, teams);
    const stamps = [news?.generated, teams?.generated].filter(Boolean).map(Date.parse);
    els.updated.textContent = stamps.length
      ? `Updated ${formatUpdated(new Date(Math.max(...stamps)).toISOString())}`
      : 'Not refreshed yet.';
    render();
  }

  init();
})();
