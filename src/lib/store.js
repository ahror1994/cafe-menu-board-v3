// Simple localStorage store for Мангал-Бургер (v3)
const KEY = 'mangal-burger-menu-v3';
const OLD_KEYS = ['sushi-ordo-menu-v2', 'cafe-menu-v3', 'cafe-menu-v2'];

function uid() { return Math.random().toString(36).slice(2, 9); }

function defaultStyle() {
  return {
    bg: '#000000',
    bgOpacity: 0.58,
    blur: 12,
    radius: 13,
    borderOpacity: 0,
    shadow: false,
    textColor: '#ffffff',
    priceBg: '#ad2525',
    priceColor: '#ffffff',
  };
}

function normalizeItem(raw, i) {
  const cols = [46, 30, 32];
  const rawW = typeof raw.w === 'number' ? raw.w : raw.w ? Number(raw.w) : cols[i % cols.length];
  // clamp width to prevent old huge values from breaking layout
  const w = Math.max(12, Math.min(88, rawW));
  return {
    id: raw.id || uid(),
    title: raw.title || raw.name || 'Блюдо',
    desc: raw.desc || raw.subtitle || '',
    weight: raw.weight || raw.gram || raw.grams || raw.gramm || '',
    price: raw.price || '0.-',
    x: typeof raw.x === 'number' ? Math.max(0, Math.min(100 - w, raw.x)) : (i === 0 ? 6 : i === 1 ? 52 : 10 + i * 30) % 60,
    y: typeof raw.y === 'number' ? raw.y : 68,
    w,
    style: { ...defaultStyle(), ...(raw.style || {}) },
  };
}

const SLIDE_DUR = 18;
const MIX_POOL = ['fire', 'prism', 'crt', 'curtain', 'zoomBurst', 'flip3d', 'blinds', 'displacement'];

function makeSlides(tvId, count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `s_${tvId}_${i + 1}`,
    type: 'image',
    bg: `/cafe-menu-board-v3/data/img/${tvId}-${String(i + 1).padStart(2, '0')}.jpg`,
    duration: SLIDE_DUR,
    transition: MIX_POOL[i % MIX_POOL.length],
    items: [],
  }));
}

function makeVideoSlide(id, filename, duration, transition = 'fire') {
  return {
    id,
    type: 'video',
    bg: `/cafe-menu-board-v3/data/video/${filename}`,
    duration,
    transition,
    items: [],
  };
}

function withVideos(slides, insertions) {
  const out = [...slides];
  // insertions sorted descending by index or applied in order with offset
  let offset = 0;
  for (const [idx, vSlide] of insertions) {
    out.splice(idx + offset, 0, vSlide);
    offset++;
  }
  return out;
}

const RAW_DEFAULT = {
  screens: [
    {
      id: 'tv1',
      name: 'Экран 1',
      slides: withVideos(makeSlides('tv1', 10), [
        [4, makeVideoSlide('v_tv1_1', 'tv1.mp4', 22, 'fire')],
      ]),
    },
    {
      id: 'tv2',
      name: 'Экран 2',
      slides: withVideos(makeSlides('tv2', 5), [
        [1, makeVideoSlide('v_tv2_1', 'tv2.mp4', 28, 'prism')],
        [3, makeVideoSlide('v_tv2_2', 'tv2-2.mp4', 30, 'crt')],
      ]),
    },
    {
      id: 'tv3',
      name: 'Экран 3',
      slides: withVideos(makeSlides('tv3', 9), [
        [6, makeVideoSlide('v_tv3_1', 'tv3.mp4', 26, 'zoomBurst')],
      ]),
    },
  ],
};

export function normalizeStore(raw) {
  if (!raw || !raw.screens) return normalizeStore(RAW_DEFAULT);
  const screens = (raw.screens || []).map((sc) => ({
    id: sc.id,
    name: sc.name || `Экран ${sc.id.replace('tv', '')}`,
    slides: (sc.slides || []).map((sl) => ({
      id: sl.id,
      type: sl.type || 'image',
      bg: sl.bg,
      duration: sl.duration || 18,
      transition: sl.transition || 'fire',
      items: (sl.items || []).map((it, idx) => normalizeItem(it, idx)),
    })),
  }));

  // Гарантируем наличие всех 3 экранов (tv1 .. tv3)
  for (let i = 1; i <= 3; i++) {
    const id = `tv${i}`;
    if (!screens.some((s) => s.id === id)) {
      const defSc = RAW_DEFAULT.screens.find((s) => s.id === id);
      screens.push(defSc ? structuredClone(defSc) : { id, name: `Экран ${i}`, slides: [] });
    }
  }

  // Сортировка tv1 .. tv6
  screens.sort((a, b) => {
    const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  return { screens };
}

const DEFAULT = normalizeStore(RAW_DEFAULT);
export function loadStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw);
    return normalizeStore(parsed);
  } catch { return structuredClone(DEFAULT); }
}

export function wipeOldKeys() {
  for (const k of OLD_KEYS) try { localStorage.removeItem(k); localStorage.removeItem(k + '_ts'); } catch {}
}

export function saveStore(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.setItem(KEY + '_ts', Date.now().toString());
  } catch (e) {
    console.warn('localStorage save warning:', e);
  }
}

// время последней правки на этом устройстве (0 = здесь не редактировали)
export function localTs() {
  try { return Number(localStorage.getItem(KEY + '_ts') || 0); } catch { return 0; }
}

// записать данные в кэш, не помечая их как «свежая правка» (приходит из облака)
export function cacheStore(data, ts) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.setItem(KEY + '_ts', String(ts || 0));
  } catch {}
}

// чистим только данные меню — токен облака и другой localStorage не трогаем
export function clearMenuKeys() {
  for (const k of [...OLD_KEYS, KEY]) {
    try { localStorage.removeItem(k); localStorage.removeItem(k + '_ts'); } catch {}
  }
}

export function resetStore() {
  const d = structuredClone(DEFAULT);
  saveStore(d);
  return d;
}

export function createEmptyItem() {
  return normalizeItem({ title: 'Новое блюдо', desc: '', price: '300 ₽', x: 30, y: 36, w: 36 }, 0);
}

export function makeId() { return uid(); }

export const TRANSITIONS = [
  { id: 'auto', label: '✨ Микс (авто-переключение эффектов)' },
  { id: 'fire', label: '🔥 Огненный всполох (Мангал)' },
  { id: 'prism', label: '🌈 Неоновая призма' },
  { id: 'crt', label: '📺 Ретро-ТВ (Включение / Канал)' },
  { id: 'curtain', label: '🎭 Яркая шторка' },
  { id: 'zoomBurst', label: '💥 Взрывной зум + вспышка' },
  { id: 'flip3d', label: '🧊 3D Переворот' },
  { id: 'blinds', label: '🪟 Жалюзи' },
  { id: 'displacement', label: '🌊 Жидкая волна (GL Warp)' },
  { id: 'fade', label: 'Fade + Scale' },
  { id: 'slide', label: 'Slide влево' },
  { id: 'zoom', label: 'Zoom + Blur' },
  { id: 'cube', label: '3D Cube' },
  { id: 'pixel', label: 'Pixelate' },
];

export const DEFAULT_STYLE = defaultStyle();

export function hexToRgba(hex, opacity = 1) {
  try {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  } catch { return `rgba(255,255,255,${opacity})`; }
}
