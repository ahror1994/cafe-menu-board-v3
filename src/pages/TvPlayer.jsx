import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { loadStore, cacheStore } from '../lib/store';
import { fetchCloud } from '../lib/cloud';
import GlassPill from '../components/GlassPill';
import DisplacementTransition from '../components/DisplacementTransition';

// метка версии сборки — видна в верхней полосе ТВ, чтобы понимать: свежая версия или кэш
const APP_VERSION = '2026-11-20.6';

const AUTO_POOL = ['fire', 'prism', 'crt', 'curtain', 'zoomBurst', 'flip3d', 'slide'];

function getFsElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

function requestElFs(el) {
  if (!el) return false;
  const fn =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen;
  if (!fn) return false;
  try {
    const res = fn.call(el);
    if (res && typeof res.catch === 'function') res.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function exitDocFs() {
  const fn =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.mozCancelFullScreen ||
    document.msExitFullscreen;
  if (!fn) return;
  try {
    const res = fn.call(document);
    if (res && typeof res.catch === 'function') res.catch(() => {});
  } catch {}
}

const variants = {
  videoFade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  fade: {
    initial: { opacity: 0, scale: 1.03 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
  slide: {
    initial: { x: '100%', opacity: 0.25 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '-30%', opacity: 0 },
  },
  zoom: {
    initial: { scale: 1.18, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.92, opacity: 0 },
  },
  blinds: {
    initial: { scaleX: 0.08, opacity: 0.3, transformOrigin: 'left center' },
    animate: { scaleX: 1, opacity: 1, transformOrigin: 'left center' },
    exit: { scaleX: 0.08, opacity: 0, transformOrigin: 'right center' },
  },
  cube: {
    initial: { rotateY: 85, opacity: 0.2, transformOrigin: 'right center' },
    animate: { rotateY: 0, opacity: 1 },
    exit: { rotateY: -85, opacity: 0.2, transformOrigin: 'left center' },
  },
  pixel: {
    initial: { opacity: 0, scale: 1.06 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  fire: {
    initial: { opacity: 0, scale: 1.1 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  prism: {
    initial: { x: '12%', scale: 1.06, opacity: 0 },
    animate: { x: 0, scale: 1, opacity: 1 },
    exit: { x: '-12%', scale: 0.96, opacity: 0 },
  },
  crt: {
    initial: { scaleY: 0.04, scaleX: 1.12, opacity: 0.85 },
    animate: { scaleY: 1, scaleX: 1, opacity: 1 },
    exit: { scaleY: 0.03, scaleX: 1.14, opacity: 0 },
  },
  curtain: {
    initial: { scaleX: 0.05, opacity: 0.4, transformOrigin: 'left center' },
    animate: { scaleX: 1, opacity: 1, transformOrigin: 'left center' },
    exit: { scaleX: 0.05, opacity: 0, transformOrigin: 'right center' },
  },
  zoomBurst: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 1.16, opacity: 0 },
  },
  flip3d: {
    initial: { rotateY: -85, scale: 0.94, opacity: 0 },
    animate: { rotateY: 0, scale: 1, opacity: 1 },
    exit: { rotateY: 85, scale: 0.94, opacity: 0 },
  },
};

function resolveBg(bg) {
  if (!bg) return '';
  const m = bg.match(/^\/cafe-menu-board(?:-v\d+)?\/(.*)$/);
  if (m) return `${import.meta.env.BASE_URL}${m[1]}`;
  return bg;
}

const fxOverlayBase = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  width: '100%',
  height: '100%',
  zIndex: 15,
  pointerEvents: 'none',
};

/** Colorful light-sweep / CRT / ember overlay during slide transitions (compositor-only, no mixBlendMode) */
function TransitionFX({ type, fxKey }) {
  if (!type || type === 'fade' || type === 'displacement' || type === 'slide') return null;

  if (type === 'fire' || type === 'zoomBurst') {
    return (
      <motion.div
        key={fxKey}
        initial={{ x: '-115%', opacity: 0.85 }}
        animate={{ x: '125%', opacity: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        style={{
          ...fxOverlayBase,
          background:
            'linear-gradient(105deg, transparent 0%, rgba(255,94,0,0.32) 35%, rgba(255,204,0,0.5) 50%, rgba(255,42,0,0.28) 65%, transparent 100%)',
        }}
      />
    );
  }

  if (type === 'prism' || type === 'curtain') {
    return (
      <motion.div
        key={fxKey}
        initial={{ x: '-110%', opacity: 0.8 }}
        animate={{ x: '120%', opacity: 0 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        style={{
          ...fxOverlayBase,
          background:
            'linear-gradient(110deg, transparent 0%, rgba(255,0,128,0.28) 28%, rgba(255,196,0,0.45) 48%, rgba(0,229,255,0.36) 68%, transparent 100%)',
        }}
      />
    );
  }

  if (type === 'crt') {
    return (
      <motion.div
        key={fxKey}
        initial={{ opacity: 0.75 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{
          ...fxOverlayBase,
          background:
            'radial-gradient(circle at center, rgba(255,210,120,0.45) 0%, rgba(0,220,255,0.22) 55%, transparent 90%)',
        }}
      />
    );
  }

  return null;
}

function Slide({ slide, onVideoEnd, onVideoDuration }) {
  const isVideo = slide.type === 'video';
  const bg = resolveBg(slide.bg);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!isVideo) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const p = v.play?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, [bg, isVideo]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        overflow: 'hidden',
        perspective: 1200,
      }}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          src={bg}
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onEnded={onVideoEnd}
          onError={() => setTimeout(() => onVideoEnd?.(), 3000)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (d && Number.isFinite(d) && d > 0) onVideoDuration?.(d);
          }}
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      ) : (
        <img
          src={bg}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            display: 'block',
            willChange: 'transform',
            animation: `tvKenBurns ${(slide.duration || 18) + 1}s linear forwards`,
          }}
        />
      )}
      {/* Subtle warm mangal vignette */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          pointerEvents: 'none',
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

const fallbackScreenStyle = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: '#0a0a0a',
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  gap: 12,
  textAlign: 'center',
  userSelect: 'none',
  WebkitUserSelect: 'none',
};

const fallbackBadgeStyle = {
  padding: '4px 12px',
  borderRadius: 9999,
  backgroundColor: 'rgba(217, 119, 6, 0.2)',
  color: '#fbbf24',
  border: '1px solid rgba(245, 158, 11, 0.3)',
  fontSize: 12,
  fontWeight: 700,
};

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
  const safeIdx = slides.length ? idx % slides.length : 0;

  useEffect(() => {
    if (slides.length && idx >= slides.length) {
      setIdx(0);
    }
  }, [idx, slides.length]);

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
      const s = slides[(safeIdx + offset) % slides.length];
      if (s && s.type !== 'video' && s.bg) {
        const img = new Image();
        img.src = resolveBg(s.bg);
      }
    });
  }, [safeIdx, slides]);

  const effectiveTransition = useMemo(() => {
    const cur = slides[safeIdx];
    if (!cur) return 'fire';
    if (!cur.transition || cur.transition === 'auto') {
      return AUTO_POOL[safeIdx % AUTO_POOL.length];
    }
    return cur.transition;
  }, [slides, safeIdx]);

  const goNext = useCallback(
    (nextIdx) => {
      const cur = slides[safeIdx];
      const nxt = slides[nextIdx];
      if (!cur || !nxt) return setIdx(nextIdx);
      const curTr = cur.transition === 'auto' ? AUTO_POOL[safeIdx % AUTO_POOL.length] : cur.transition;
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
    [slides, safeIdx]
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

  // облако: подтягиваем свежие данные (защита от устаревшего ответа CDN)
  const lastCloudTs = useRef(0);
  const pollCloud = useCallback(async () => {
    const cloud = await fetchCloud(10000, true);
    const ct = cloud?.updatedAt ? Date.parse(cloud.updatedAt) || 0 : 0;
    if (!ct || ct <= lastCloudTs.current) return;
    lastCloudTs.current = ct;
    setStore(cloud.data);
    cacheStore(cloud.data, ct);
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
  }, [safeIdx]);

  // autoplay: for images use duration (18s); for videos wait for onEnded (with generous safety fallback)
  useEffect(() => {
    if (!slides.length || disp) return;
    const cur = slides[safeIdx];
    const isVideo = cur?.type === 'video';
    const durMs = isVideo
      ? ((cur?.duration || 30) + 15) * 1000
      : (cur?.duration || 18) * 1000;
    timerRef.current = setTimeout(() => {
      const next = (safeIdx + 1) % slides.length;
      goNext(next);
    }, durMs);
    return () => clearTimeout(timerRef.current);
  }, [safeIdx, slides, disp, goNext]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [softFs, setSoftFs] = useState(false);
  const [showChrome, setShowChrome] = useState(true);
  const containerRef = useRef(null);
  const chromeTimerRef = useRef(null);

  const activeFs = isFullscreen || softFs;

  useEffect(() => {
    const onFs = () => {
      const fs = Boolean(getFsElement());
      setIsFullscreen(fs);
      if (!fs) setSoftFs(false);
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    document.addEventListener('mozfullscreenchange', onFs);
    document.addEventListener('MSFullscreenChange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      document.removeEventListener('mozfullscreenchange', onFs);
      document.removeEventListener('MSFullscreenChange', onFs);
    };
  }, []);

  useEffect(() => {
    if (!activeFs) {
      clearTimeout(chromeTimerRef.current);
      setShowChrome(true);
      return;
    }
    setShowChrome(false);
    const onMove = () => {
      setShowChrome(true);
      clearTimeout(chromeTimerRef.current);
      chromeTimerRef.current = setTimeout(() => setShowChrome(false), 4000);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      clearTimeout(chromeTimerRef.current);
      window.removeEventListener('mousemove', onMove);
    };
  }, [activeFs]);

  const enterFullscreen = useCallback(() => {
    if (!requestElFs(containerRef.current)) {
      requestElFs(document.documentElement);
    }
    setSoftFs(true);
    setShowChrome(false);
  }, []);

  const exitFullscreen = useCallback(() => {
    exitDocFs();
    setSoftFs(false);
    setShowChrome(true);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (activeFs) exitFullscreen();
    else enterFullscreen();
  }, [activeFs, enterFullscreen, exitFullscreen]);

  const handleStageClick = useCallback(() => {
    if (!getFsElement()) {
      enterFullscreen();
    }
  }, [enterFullscreen]);

  useEffect(() => {
    const onKey = (e) => {
      if (disp) return;
      if (e.key === 'ArrowRight') goNext((safeIdx + 1) % slides.length);
      if (e.key === 'ArrowLeft') goNext((safeIdx - 1 + slides.length) % slides.length);
      if (e.key === 'f' || e.key === 'F') enterFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length, safeIdx, disp, goNext, enterFullscreen]);

  function handleDispDone() {
    if (disp) {
      setIdx(disp.pendingIdx);
      setDisp(null);
    }
  }

  if (!screen) {
    return (
      <div style={fallbackScreenStyle}>
        <div style={fallbackBadgeStyle}>🔥 Мангал-Бургер</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Экран «{id}» не найден</h1>
        <p style={{ color: '#a1a1aa', fontSize: 14, margin: 0 }}>Проверьте список экранов в админке /admin</p>
      </div>
    );
  }

  if (!slides.length) {
    return (
      <div style={fallbackScreenStyle}>
        <div style={fallbackBadgeStyle}>🔥 Мангал-Бургер</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {screen.name} ({screen.id.toUpperCase()})
        </h1>
        <p style={{ color: '#a1a1aa', fontSize: 14, margin: 0 }}>
          Экран подключен и ожидает слайды. Добавьте слайд в админке:{' '}
          <a href="#/admin" style={{ color: '#fff', textDecoration: 'underline', fontWeight: 600 }}>
            /admin
          </a>
        </p>
      </div>
    );
  }
  const current = slides[safeIdx];
  const currentDur = current.type === 'video' && videoDuration ? Math.ceil(videoDuration) : (current.duration || 18);

  return (
    <div
      ref={containerRef}
      onClick={handleStageClick}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: activeFs && !showChrome ? 'none' : 'pointer',
      }}
    >
      {/* Top status bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 38,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: 'rgba(255,255,255,0.92)',
          fontSize: 12,
          letterSpacing: '0.025em',
          opacity: activeFs && !showChrome ? 0 : 1,
          pointerEvents: activeFs && !showChrome ? 'none' : 'auto',
          transition: 'opacity 0.4s ease',
          boxSizing: 'border-box',
        }}
      >
        <span>
          🔥 Мангал-Бургер • {screen.name} • {safeIdx + 1} / {slides.length} • {effectiveTransition} • {currentDur}с • v{APP_VERSION}{' '}
          {disp ? '• liquid warp…' : ''}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="opacity-60 hidden sm:inline" style={{ opacity: 0.65 }}>
            ← → листать • F фуллскрин
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 9999,
              backgroundColor: '#fff',
              color: '#000',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {activeFs ? 'Выйти' : '⛶ На весь экран'}
          </button>
        </span>
      </div>

      {/* Main stage */}
      <div
        style={{
          position: 'absolute',
          top: activeFs && !showChrome ? 0 : 38,
          right: 0,
          bottom: 0,
          left: 0,
          overflow: 'hidden',
          backgroundColor: '#000',
          perspective: 1400,
        }}
      >
        {disp ? (
          <div
            key={disp.key}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          >
            <DisplacementTransition from={disp.from} to={disp.to} duration={1100} onDone={handleDispDone} />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
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
                key={current.id + '-' + safeIdx}
                variants={current.type === 'video' ? variants.videoFade : (variants[effectiveTransition] || variants.fire)}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={
                  current.type === 'video'
                    ? { duration: 0.4, ease: 'easeOut' }
                    : { duration: 0.85, ease: [0.22, 1, 0.36, 1] }
                }
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  willChange: 'transform, opacity',
                }}
              >
                <Slide
                  slide={current}
                  onVideoEnd={() => {
                    if (disp) return;
                    clearTimeout(timerRef.current);
                    goNext((safeIdx + 1) % slides.length);
                  }}
                  onVideoDuration={(d) => setVideoDuration(d)}
                />
              </motion.div>
            </AnimatePresence>
            {current.type !== 'video' && (
              <TransitionFX type={effectiveTransition} fxKey={`fx-${current.id}-${safeIdx}`} />
            )}
          </>
        )}
      </div>

      {/* TV Power-On CRT Intro (unmounts unconditionally after 1000ms) */}
      {powerOn && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.95, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 30,
            backgroundColor: '#000',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <motion.div
            initial={{ scaleX: 0.05, scaleY: 0.008, opacity: 1 }}
            animate={{ scaleX: 1.2, scaleY: 1.2, opacity: 0 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: '100%',
              height: '100%',
              background:
                'radial-gradient(ellipse at center, rgba(255,245,220,0.95) 0%, rgba(255,140,0,0.6) 40%, transparent 75%)',
            }}
          />
        </motion.div>
      )}

      {/* Slide indicator dots */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          display: 'flex',
          gap: 8,
          opacity: activeFs && !showChrome ? 0 : 1,
          pointerEvents: activeFs && !showChrome ? 'none' : 'auto',
          transition: 'opacity 0.4s ease',
        }}
      >
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              if (!disp) goNext(i);
            }}
            style={{
              height: 6,
              width: i === safeIdx ? 32 : 20,
              borderRadius: 9999,
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              backgroundColor: i === safeIdx ? '#fbbf24' : 'rgba(255,255,255,0.35)',
              boxShadow: i === safeIdx ? '0 0 8px rgba(251,191,36,0.8)' : 'none',
              transition: 'all 0.25s ease',
            }}
          />
        ))}
      </div>

      {/* Subtle 18s progress bar at bottom (CSS compositor animation, zero JS rAF) */}
      {!disp && (
        <div
          key={`prog-${safeIdx}-${current.id}-${currentDur}`}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            zIndex: 20,
            pointerEvents: 'none',
            transformOrigin: 'left center',
            background: 'linear-gradient(to right, #ef4444, #fbbf24, #fde047)',
            opacity: 0.85,
            willChange: 'transform',
            animation: `tvProgress ${currentDur}s linear forwards`,
          }}
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
