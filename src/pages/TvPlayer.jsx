import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { loadStore, cacheStore } from '../lib/store';
import { fetchCloud } from '../lib/cloud';
import GlassPill from '../components/GlassPill';
import DisplacementTransition from '../components/DisplacementTransition';

// метка версии сборки — видна в верхней полосе ТВ, чтобы понимать: свежая версия или кэш
const APP_VERSION = '2026-11-19.3';

const AUTO_POOL = ['fire', 'prism', 'crt', 'curtain', 'zoomBurst', 'flip3d', 'blinds', 'displacement'];

const variants = {
  fade: {
    initial: { opacity: 0, scale: 1.04 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
  slide: {
    initial: { x: '100%', opacity: 0.2 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '-35%', opacity: 0 },
  },
  zoom: {
    initial: { scale: 1.25, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.9, opacity: 0 },
  },
  blinds: {
    initial: { clipPath: 'inset(0 100% 0 0)', opacity: 0.4 },
    animate: { clipPath: 'inset(0 0% 0 0)', opacity: 1 },
    exit: { clipPath: 'inset(0 0 0 100%)', opacity: 0.2 },
  },
  cube: {
    initial: { rotateY: 88, opacity: 0.2, transformOrigin: 'right center' },
    animate: { rotateY: 0, opacity: 1 },
    exit: { rotateY: -88, opacity: 0.2, transformOrigin: 'left center' },
  },
  pixel: {
    initial: { opacity: 0, scale: 1.06, filter: 'contrast(1.6) saturate(1.5)' },
    animate: { opacity: 1, scale: 1, filter: 'contrast(1) saturate(1)' },
    exit: { opacity: 0, scale: 0.96, filter: 'contrast(1.4)' },
  },
  fire: {
    initial: { opacity: 0, scale: 1.12, filter: 'brightness(1.35) saturate(1.45)' },
    animate: { opacity: 1, scale: 1, filter: 'brightness(1) saturate(1)' },
    exit: { opacity: 0, scale: 0.95, filter: 'brightness(1.25) saturate(1.4)' },
  },
  prism: {
    initial: { x: '12%', scale: 1.08, opacity: 0, filter: 'saturate(1.6) hue-rotate(25deg)' },
    animate: { x: 0, scale: 1, opacity: 1, filter: 'saturate(1) hue-rotate(0deg)' },
    exit: { x: '-12%', scale: 0.96, opacity: 0, filter: 'saturate(1.5) hue-rotate(-25deg)' },
  },
  crt: {
    initial: { scaleY: 0.03, scaleX: 1.18, opacity: 0.9, filter: 'brightness(2.2) contrast(1.5)' },
    animate: { scaleY: 1, scaleX: 1, opacity: 1, filter: 'brightness(1) contrast(1)' },
    exit: { scaleY: 0.02, scaleX: 1.22, opacity: 0, filter: 'brightness(2.4) contrast(1.6)' },
  },
  curtain: {
    initial: { clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)', scale: 1.05, opacity: 0.6 },
    animate: { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', scale: 1, opacity: 1 },
    exit: { clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)', scale: 0.97, opacity: 0.3 },
  },
  zoomBurst: {
    initial: { scale: 0.72, opacity: 0, filter: 'brightness(1.4) saturate(1.35)' },
    animate: { scale: 1, opacity: 1, filter: 'brightness(1) saturate(1)' },
    exit: { scale: 1.22, opacity: 0, filter: 'brightness(1.3)' },
  },
  flip3d: {
    initial: { rotateY: -90, scale: 0.9, opacity: 0 },
    animate: { rotateY: 0, scale: 1, opacity: 1 },
    exit: { rotateY: 90, scale: 0.9, opacity: 0 },
  },
};

function resolveBg(bg) {
  if (!bg) return '';
  const m = bg.match(/^\/cafe-menu-board(?:-v\d+)?\/(.*)$/);
  if (m) return `${import.meta.env.BASE_URL}${m[1]}`;
  return bg;
}

/** Colorful light-sweep / CRT / ember overlay during slide transitions */
function TransitionFX({ type, fxKey }) {
  if (!type || type === 'fade' || type === 'displacement') return null;

  if (type === 'fire' || type === 'zoomBurst') {
    return (
      <motion.div
        key={fxKey}
        initial={{ x: '-120%', opacity: 0.9 }}
        animate={{ x: '130%', opacity: 0 }}
        transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute inset-0 z-15"
        style={{
          background:
            'linear-gradient(105deg, transparent 0%, rgba(255,94,0,0.38) 35%, rgba(255,204,0,0.65) 50%, rgba(255,42,0,0.35) 65%, transparent 100%)',
          mixBlendMode: 'screen',
        }}
      />
    );
  }

  if (type === 'prism' || type === 'curtain') {
    return (
      <motion.div
        key={fxKey}
        initial={{ x: '-110%', opacity: 0.85 }}
        animate={{ x: '125%', opacity: 0 }}
        transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute inset-0 z-15"
        style={{
          background:
            'linear-gradient(110deg, transparent 0%, rgba(255,0,128,0.35) 28%, rgba(255,196,0,0.55) 48%, rgba(0,229,255,0.45) 68%, transparent 100%)',
          mixBlendMode: 'screen',
        }}
      />
    );
  }

  if (type === 'crt') {
    return (
      <motion.div
        key={fxKey}
        initial={{ opacity: 0.95 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.85, ease: 'easeOut' }}
        className="pointer-events-none absolute inset-0 z-15"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.16) 0px, rgba(255,255,255,0.16) 2px, transparent 2px, transparent 5px), radial-gradient(circle at center, rgba(255,180,60,0.38) 0%, rgba(0,220,255,0.2) 55%, rgba(0,0,0,0.5) 100%)',
          mixBlendMode: 'screen',
        }}
      />
    );
  }

  return null;
}

function Slide({ slide, onVideoEnd, onVideoDuration }) {
  const isVideo = slide.type === 'video';
  const bg = resolveBg(slide.bg);
  return (
    <div className="absolute inset-0 overflow-hidden bg-black" style={{ perspective: 1200 }}>
      {isVideo ? (
        <video
          src={bg}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={onVideoEnd}
          onError={() => setTimeout(() => onVideoEnd?.(), 3000)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (d && Number.isFinite(d) && d > 0) onVideoDuration?.(d);
          }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <motion.img
          src={bg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover will-change-transform"
          initial={{ scale: 1.0 }}
          animate={{ scale: 1.045 }}
          transition={{ duration: (slide.duration || 18) + 1, ease: 'linear' }}
        />
      )}
      {/* Subtle warm mangal vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,0.34) 100%), linear-gradient(to top, rgba(18,6,0,0.28) 0%, transparent 18%)',
        }}
      />
      {slide.items?.map((item, idx) => (
        <div
          key={item.id}
          style={{
            position: 'absolute',
            left: `${item.x}%`,
            top: `${item.y}%`,
            width: `${item.w}%`,
            fontSize: 'clamp(10px, 1.05vw, 22px)',
          }}
        >
          <GlassPill item={item} index={idx} />
        </div>
      ))}
    </div>
  );
}

export default function TvPlayer() {
  const { id } = useParams();
  const [store, setStore] = useState(() => loadStore());
  const [idx, setIdx] = useState(0);
  const [disp, setDisp] = useState(null);
  const [powerOn, setPowerOn] = useState(true);
  const [videoDuration, setVideoDuration] = useState(null);
  const timerRef = useRef(null);
  const screen = store.screens.find((s) => s.id === id);
  const slides = screen?.slides?.length ? screen.slides : [];

  // CRT / Cinema TV power-on intro on mount
  useEffect(() => {
    setPowerOn(true);
    const t = setTimeout(() => setPowerOn(false), 1000);
    return () => clearTimeout(t);
  }, [id]);

  // Preload next 2 images so older TVs never flicker or lag on transitions
  useEffect(() => {
    if (slides.length < 2) return;
    [1, 2].forEach((offset) => {
      const s = slides[(idx + offset) % slides.length];
      if (s && s.type !== 'video' && s.bg) {
        const img = new Image();
        img.src = resolveBg(s.bg);
      }
    });
  }, [idx, slides]);

  const effectiveTransition = useMemo(() => {
    const cur = slides[idx];
    if (!cur) return 'fire';
    if (!cur.transition || cur.transition === 'auto') {
      return AUTO_POOL[idx % AUTO_POOL.length];
    }
    return cur.transition;
  }, [slides, idx]);

  const goNext = useCallback(
    (nextIdx) => {
      const cur = slides[idx];
      const nxt = slides[nextIdx];
      if (!cur || !nxt) return setIdx(nextIdx);
      const curTr = cur.transition === 'auto' ? AUTO_POOL[idx % AUTO_POOL.length] : cur.transition;
      const nxtTr = nxt.transition === 'auto' ? AUTO_POOL[nextIdx % AUTO_POOL.length] : nxt.transition;
      const useDisp = curTr === 'displacement' || nxtTr === 'displacement';
      const needsTexture = useDisp && cur.type !== 'video' && nxt.type !== 'video';
      if (needsTexture) {
        setDisp({
          from: resolveBg(cur.bg),
          to: resolveBg(nxt.bg),
          pendingIdx: nextIdx,
          key: `${cur.id}->${nxt.id}-${Date.now()}`,
        });
      } else {
        setIdx(nextIdx);
      }
    },
    [slides, idx]
  );

  // Safety timeout in case WebGL hangs on an older TV
  useEffect(() => {
    if (!disp) return;
    const safety = setTimeout(() => {
      setIdx(disp.pendingIdx);
      setDisp(null);
    }, 2400);
    return () => clearTimeout(safety);
  }, [disp]);

  // локальные изменения (другая вкладка): перечитываем в реальном времени
  const lastLocalTs = useRef('');
  useEffect(() => {
    const onStorage = (e) => {
      if (
        e.key === 'mangal-burger-menu-v3' ||
        e.key === 'sushi-ordo-menu-v2' ||
        e.key?.startsWith('cafe-menu')
      ) {
        lastLocalTs.current = '';
        setStore(loadStore());
      }
    };
    window.addEventListener('storage', onStorage);
    const iv = setInterval(() => {
      let ts = '';
      try {
        ts =
          localStorage.getItem('mangal-burger-menu-v3_ts') ||
          localStorage.getItem('sushi-ordo-menu-v2_ts') ||
          localStorage.getItem('cafe-menu-v3_ts') ||
          '';
      } catch {}
      if (ts === lastLocalTs.current) return;
      lastLocalTs.current = ts;
      setStore(loadStore());
    }, 1000);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(iv);
    };
  }, []);

  // облако: подтягиваем свежие данные
  const lastCloud = useRef('');
  const pollCloud = useCallback(async () => {
    const cloud = await fetchCloud(10000, true);
    if (!cloud?.updatedAt || cloud.updatedAt === lastCloud.current) return;
    lastCloud.current = cloud.updatedAt;
    setStore(cloud.data);
    cacheStore(cloud.data, Date.parse(cloud.updatedAt) || Date.now());
  }, []);
  useEffect(() => {
    pollCloud();
    const iv = setInterval(pollCloud, 5000);
    const onVis = () => {
      if (document.visibilityState !== 'hidden') pollCloud();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', pollCloud);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', pollCloud);
    };
  }, [pollCloud]);
  useEffect(() => {
    setIdx(0);
    setDisp(null);
    setVideoDuration(null);
  }, [id, screen?.id]);

  // Reset measured videoDuration when slide changes
  useEffect(() => {
    setVideoDuration(null);
  }, [idx]);

  // autoplay: for images use duration (18s); for videos wait for onEnded (with generous safety fallback)
  useEffect(() => {
    if (!slides.length || disp) return;
    const cur = slides[idx];
    const isVideo = cur?.type === 'video';
    const durMs = isVideo
      ? ((cur?.duration || 30) + 15) * 1000
      : (cur?.duration || 18) * 1000;
    timerRef.current = setTimeout(() => {
      const next = (idx + 1) % slides.length;
      goNext(next);
    }, durMs);
    return () => clearTimeout(timerRef.current);
  }, [idx, slides, disp, goNext]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChrome, setShowChrome] = useState(true);
  const containerRef = useRef(null);
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  useEffect(() => {
    if (!isFullscreen) {
      setShowChrome(true);
      return;
    }
    setShowChrome(true);
    const t = setTimeout(() => setShowChrome(false), 4000);
    const onMove = () => {
      setShowChrome(true);
      clearTimeout(t);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousemove', onMove);
    };
  }, [isFullscreen, idx, disp]);
  useEffect(() => {
    const onKey = (e) => {
      if (disp) return;
      if (e.key === 'ArrowRight') goNext((idx + 1) % slides.length);
      if (e.key === 'ArrowLeft') goNext((idx - 1 + slides.length) % slides.length);
      if (e.key === 'f' || e.key === 'F') containerRef.current?.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length, idx, disp, goNext]);

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await containerRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  }
  function handleDispDone() {
    if (disp) {
      setIdx(disp.pendingIdx);
      setDisp(null);
    }
  }

  if (!screen) {
    return (
      <div className="w-screen h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 gap-3 select-none">
        <div className="px-3 py-1 rounded-full bg-amber-600/20 text-amber-400 border border-amber-500/30 text-xs font-bold">
          🔥 Мангал-Бургер
        </div>
        <h1 className="text-xl font-bold">Экран «{id}» не найден</h1>
        <p className="text-zinc-400 text-sm">Проверьте список экранов в админке /admin</p>
      </div>
    );
  }

  if (!slides.length) {
    return (
      <div className="w-screen h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 gap-4 select-none">
        <div className="px-3 py-1 rounded-full bg-amber-600/20 text-amber-400 border border-amber-500/30 text-xs font-bold">
          🔥 Мангал-Бургер
        </div>
        <h1 className="text-2xl font-bold">
          {screen.name} ({screen.id.toUpperCase()})
        </h1>
        <p className="text-zinc-400 text-sm">
          Экран подключен и ожидает слайды. Добавьте слайд в админке:{' '}
          <a href="#/admin" className="text-white underline font-semibold">
            /admin
          </a>
        </p>
      </div>
    );
  }
  const current = slides[idx];
  const currentDur = current.type === 'video' && videoDuration ? Math.ceil(videoDuration) : (current.duration || 18);

  return (
    <div ref={containerRef} className="w-screen h-screen bg-black overflow-hidden relative select-none">
      {/* Top status bar */}
      <div
        className={`absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-2 bg-black/55 backdrop-blur text-white/90 text-xs tracking-wide transition-opacity duration-500 ${
          isFullscreen && !showChrome ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <span>
          🔥 Мангал-Бургер • {screen.name} • {idx + 1} / {slides.length} • {effectiveTransition} • {currentDur}с • v{APP_VERSION}{' '}
          {disp ? '• liquid warp…' : ''}
        </span>
        <span className="flex items-center gap-2">
          <span className="opacity-60 hidden sm:inline">← → листать • F фуллскрин</span>
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-full bg-white text-black font-bold hover:bg-zinc-100"
          >
            {isFullscreen ? 'Выйти' : '⛶ На весь экран'}
          </button>
        </span>
      </div>

      {/* Main stage */}
      <div
        className={`absolute inset-0 ${isFullscreen && !showChrome ? 'pt-0' : 'pt-8'} transition-all`}
        style={{ perspective: 1400 }}
      >
        {disp ? (
          <div key={disp.key} className="absolute inset-0">
            <DisplacementTransition from={disp.from} to={disp.to} duration={1100} onDone={handleDispDone} />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="absolute inset-0 pointer-events-none"
            >
              {slides[disp.pendingIdx]?.items?.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.07 }}
                  style={{
                    position: 'absolute',
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    width: `${item.w}%`,
                    fontSize: 'clamp(10px, 1.05vw, 22px)',
                  }}
                >
                  <GlassPill item={item} index={i} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current.id + '-' + idx}
                variants={variants[effectiveTransition] || variants.fire}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 will-change-transform"
              >
                <Slide
                  slide={current}
                  onVideoEnd={() => {
                    if (disp) return;
                    clearTimeout(timerRef.current);
                    goNext((idx + 1) % slides.length);
                  }}
                  onVideoDuration={(d) => setVideoDuration(d)}
                />
              </motion.div>
            </AnimatePresence>
            <TransitionFX type={effectiveTransition} fxKey={`fx-${current.id}-${idx}`} />
          </>
        )}
      </div>

      {/* TV Power-On CRT Intro */}
      <AnimatePresence>
        {powerOn && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.95, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 z-30 bg-black flex items-center justify-center"
          >
            <motion.div
              initial={{ scaleX: 0.05, scaleY: 0.008, opacity: 1 }}
              animate={{ scaleX: 1.2, scaleY: 1.2, opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(255,245,220,0.95) 0%, rgba(255,140,0,0.6) 40%, transparent 75%)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!isFullscreen && !disp && (
        <button
          onClick={toggleFullscreen}
          className="absolute inset-0 z-10 cursor-pointer opacity-0"
          aria-label="tap for fullscreen"
        />
      )}

      {/* Slide indicator dots */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 transition-opacity ${
          isFullscreen && !showChrome ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => !disp && goNext(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? 'w-8 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'w-5 bg-white/35'
            }`}
          />
        ))}
      </div>

      {/* Subtle 18s progress bar at bottom */}
      {!disp && (
        <motion.div
          key={`prog-${idx}-${current.id}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: currentDur, ease: 'linear' }}
          style={{ transformOrigin: 'left center' }}
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] z-20 bg-gradient-to-r from-red-500 via-amber-400 to-yellow-300 opacity-85"
        />
      )}

      <ReloadEachHour />
    </div>
  );
}

function ReloadEachHour() {
  useEffect(() => {
    const iv = setInterval(() => window.location.reload(), 60 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);
  return null;
}
