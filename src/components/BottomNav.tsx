import { BarChart3, BookOpen, CalendarClock, Home, Layers } from 'lucide-react';

export type TabId = 'home' | 'quiz' | 'planner' | 'library' | 'stats';

interface BottomNavProps {
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
  dueCount: number;
  darkMode: boolean;
}

const ITEMS: Array<{ id: TabId; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Beranda', icon: Home },
  { id: 'quiz', label: 'Bank Soal', icon: Layers },
  { id: 'planner', label: 'Jadwal', icon: CalendarClock },
  { id: 'library', label: 'Video & Card', icon: BookOpen },
  { id: 'stats', label: 'Statistik', icon: BarChart3 },
];

export function BottomNav({ activeTab, onSelect, dueCount, darkMode }: BottomNavProps) {
  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-lg safe-bottom ${
        darkMode
          ? 'bg-slate-900/95 border-slate-800 text-slate-400'
          : 'bg-white/95 border-slate-200 text-slate-500'
      }`}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 pt-1.5 pb-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors ${
                active
                  ? darkMode
                    ? 'text-emerald-400'
                    : 'text-emerald-600'
                  : 'hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.9} />
                {item.id === 'quiz' && dueCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                    {dueCount > 99 ? '99+' : dueCount}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
