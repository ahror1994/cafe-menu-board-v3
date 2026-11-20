// Cloud sync: данные лежат в самом репозитории (ветка gh-pages, файл data/menu.json).
// Чтение — публично с того же GitHub Pages (работает на ТВ и любом ПК без токена).
// Запись — коммит через GitHub API, нужен токен (хранится только в браузере админа).
import { normalizeStore } from './store.js';

const REPO = 'ahror1994/cafe-menu-board-v3';
const BRANCH = 'gh-pages';
const PATH = 'data/menu.json';
export const TOKEN_KEY = 'mangal-burger-gh-token';
const FALLBACK_TOKEN_KEY = 'sushi-ordo-gh-token';

const API = `https://api.github.com/repos/${REPO}`;

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(FALLBACK_TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(t) {
  try {
    const val = normalizeTokenInput(t);
    if (!val) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(FALLBACK_TOKEN_KEY);
    } else {
      localStorage.setItem(TOKEN_KEY, val);
    }
  } catch {}
}

// принимает и голый токен, и целую ссылку-подключение (#gh=... / ?gh=...)
export function normalizeTokenInput(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/[#&?]gh=([A-Za-z0-9._-]+)/) || s.match(/gh=([A-Za-z0-9._-]+)/);
  return m ? m[1] : s;
}

// мгновенная проверка: работает ли токен (проверяет доступ к репозиторию)
export async function checkToken(customToken) {
  const t = customToken ? normalizeTokenInput(customToken) : getToken();
  if (!t) throw new Error('Токен не указан');
  const r = await gh('', 'GET', null, t);
  if (r && r.permissions && !r.permissions.push) {
    throw new Error('У токена нет прав на запись (Contents: Read and write)');
  }
  return r && r.owner && r.owner.login ? String(r.owner.login) : 'ok';
}
export function hasToken() { return Boolean(getToken()); }

export function cloudFileUrl() { return `${import.meta.env.BASE_URL}${PATH}`; }

const RAW_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${PATH}`;

// Запрашивает актуальные данные параллельно из GitHub Pages и raw.githubusercontent.com,
// выбирая самую свежую версию по updatedAt (чтобы старый кэш CDN никогда не перетирал новые правки)
export async function fetchCloud(timeoutMs = 8000, bust = true) {
  const ts = Date.now();
  const urls = bust
    ? [`${cloudFileUrl()}?t=${ts}`, `${RAW_URL}?t=${ts}`]
    : [cloudFileUrl(), RAW_URL];

  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const t = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
        const res = await fetchStable(url, {
          cache: bust ? 'no-store' : 'default',
          ...(ctrl ? { signal: ctrl.signal } : {}),
        }, 1);
        if (t) clearTimeout(t);
        if (!res.ok) return null;
        const j = await res.json();
        if (!j || !j.data || !Array.isArray(j.data.screens)) return null;
        return { updatedAt: j.updatedAt || '', data: normalizeStore(j.data) };
      } catch {
        return null;
      }
    })
  );

  let best = null;
  let bestTs = -1;
  for (const r of results) {
    if (!r) continue;
    const rt = Date.parse(r.updatedAt) || 0;
    if (!best || rt > bestTs) {
      best = r;
      bestTs = rt;
    }
  }
  return best;
}

function b64utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

// сеть бывает нестабильной — сетевые сбои повторяем сами, HTTP-ошибки (401 и т.п.) отдаём сразу
async function fetchStable(url, opts, tries = 3) {
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fetch(url, opts);
    } catch (e) {
      lastErr = e;
      if (attempt < tries - 1) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function gh(path, method = 'GET', body, customToken) {
  const token = customToken || getToken();
  try {
    const res = await fetchStable(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let msg = `GitHub ${res.status}`;
      try { msg += `: ${(await res.json()).message}`; } catch {}
      const err = new Error(msg);
      err.isHttp = true;
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  } catch (e) {
    if (e && e.isHttp) throw e;
    // сетевой сбой после повторов — добавляем понятный контекст
    throw new Error('Failed to fetch (сеть unstable): ' + String(e.message || e));
  }
}

// Коммитит уже созданные блобы в ветку. При гонке/обрыве — повторяет целиком.
async function commitFiles(files, message) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const ref = await gh(`/git/ref/heads/${BRANCH}`);
      const commit = await gh(`/git/commits/${ref.object.sha}`);
      const tree = await gh('/git/trees', 'POST', {
        base_tree: commit.tree.sha,
        tree: files,
      });
      const newCommit = await gh('/git/commits', 'POST', {
        message: message || `update ${new Date().toISOString()}`,
        tree: tree.sha,
        parents: [ref.object.sha],
      });
      await gh(`/git/refs/heads/${BRANCH}`, 'PATCH', { sha: newCommit.sha });
      return newCommit;
    } catch (e) {
      lastErr = e;
      // гонка на ветке или сетевой сбой — пауза и повтор целиком
      if (!/409|422|Failed to fetch/i.test(String(e.message))) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function bufToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

// Загружает видеофайл (или любой файл) в репозиторий и возвращает публичный путь.
export async function uploadRepoFile(file) {
  if (!hasToken()) throw new Error('NO_TOKEN');
  const ext = (file.name.match(/\.(mp4|webm|m4v|mov)$/i) || [, 'mp4'])[1].toLowerCase();
  const name = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const path = `data/video/${name}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  const blob = await gh('/git/blobs', 'POST', { content: bufToB64(buf), encoding: 'base64' });
  await commitFiles([{ path, mode: '100644', type: 'blob', sha: blob.sha }], `video ${name}`);
  return `${import.meta.env.BASE_URL}${path}`;
}

// Публикует данные коммитом в gh-pages. Возвращает ISO-время публикации.
// При гонке (кто-то другой тоже двигает ветку) — повторяем от свежей головы несколько раз.
export async function pushCloud(data) {
  if (!hasToken()) throw new Error('NO_TOKEN');
  const updatedAt = new Date().toISOString();
  const blob = await gh('/git/blobs', 'POST', {
    content: b64utf8(JSON.stringify({ updatedAt, data })),
    encoding: 'base64',
  });
  await commitFiles([{ path: PATH, mode: '100644', type: 'blob', sha: blob.sha }], `menu update ${updatedAt}`);
  return updatedAt;
}
