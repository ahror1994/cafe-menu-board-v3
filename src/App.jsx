import { Component } from 'react';
import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Admin from './pages/Admin';
import TvPlayer from './pages/TvPlayer';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'sans-serif', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Ошибка запуска меню</div>
          <div style={{ fontSize: 13, color: '#fca5a5', maxWidth: 600, wordBreak: 'break-word' }}>{String(this.state.error.message || this.state.error)}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

const TV_LIST = [
  { id: 'tv1', label: 'Экран 1', desc: 'Комбо, бургеры и снеки (10 слайдов)' },
  { id: 'tv2', label: 'Экран 2', desc: 'Пицца (5 слайдов)' },
  { id: 'tv3', label: 'Экран 3', desc: 'Салаты и горячие блюда (9 слайдов)' },
];

function Home() {
  const originUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://ahror1994.github.io/cafe-menu-board-v3/';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-[760px] w-full rounded-[24px] bg-zinc-900 border border-zinc-800 p-8 flex flex-col gap-6 shadow-2xl">
        <div className="border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-600/20 text-amber-400 border border-amber-500/30">🔥 Мангал-Бургер</span>
            <span className="text-xs text-zinc-400 font-mono">версия 3 • 3 ТВ</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Cafe Menu Board — 3 Телевизора</h1>
          <p className="text-zinc-400 text-sm mt-1 leading-relaxed">
            Живое меню для 3 телевизоров с яркой анимацией, переходами и синхронизацией через облако.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link to="/admin" className="px-5 py-3 rounded-xl bg-white text-zinc-900 font-bold hover:bg-zinc-200 transition shadow">
            ⚙ Открыть админку → /admin
          </Link>
          <a
            href={`${originUrl}#/admin`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm font-semibold hover:bg-zinc-700 transition"
          >
            Админка в новой вкладке ↗
          </a>
        </div>

        <div>
          <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase mb-3">
            Ссылки для 3 телевизоров:
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {TV_LIST.map((tv) => (
              <Link
                key={tv.id}
                to={`/tv/${tv.id}`}
                target="_blank"
                className="group p-3.5 rounded-xl bg-zinc-800/70 border border-zinc-700/60 hover:border-white/50 hover:bg-zinc-800 transition flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white group-hover:text-amber-300 transition">
                    📺 {tv.label}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/40 text-zinc-300">
                    /tv/{tv.id}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400 leading-tight">
                  {tv.desc}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-black/40 border border-zinc-800 text-xs text-zinc-400 space-y-1.5 leading-relaxed">
          <p className="font-semibold text-zinc-300">💡 Как подключить телевизоры:</p>
          <p>
            1. Откройте на каждом ТВ встроенный браузер и перейдите по соответствующей ссылке: <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">#/tv/tv1</code> ... <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">#/tv/tv3</code>.
          </p>
          <p>
            2. Нажмите клавишу <strong>F</strong> на клавиатуре или кликните по экрану для перехода в полноэкранный режим.
          </p>
          <p>
            3. При изменении цен в админке экраны автоматически обновляются по сети.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/tv/:id" element={<TvPlayer />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
