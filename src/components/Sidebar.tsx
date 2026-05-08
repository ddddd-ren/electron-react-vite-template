import { useStore } from '../store/useStore'
import type { Page } from '../types/common'

const navItems: { icon: string; label: string; page: Page }[] = [
  { icon: 'home', label: '首页', page: 'home' },
  { icon: 'play_circle', label: '在线', page: 'source' },
  { icon: 'video_library', label: '媒体库', page: 'library' },
  { icon: 'download', label: '下载', page: 'download' },
  { icon: 'settings', label: '设置', page: 'settings' },
]

export default function Sidebar() {
  const { currentPage, setPage, sidebarCollapsed, toggleSidebar } = useStore()

  return (
    <aside
      className={`h-full flex flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)] transition-all duration-300 shrink-0 ${
        sidebarCollapsed ? 'w-16' : 'w-52'
      }`}
    >
      {/* 导航 */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const active = currentPage === item.page
          return (
            <button
              key={item.page}
              onClick={() => setPage(item.page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                active
                  ? 'bg-primary-600/15 text-primary-400'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <span
                className={`material-symbols-rounded transition-all ${
                  active ? 'text-primary-400' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                }`}
                style={{ fontSize: '22px', fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              {!sidebarCollapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* 折叠按钮 */}
      <div className="p-2 border-t border-[var(--border)]">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <span
            className="material-symbols-rounded transition-transform duration-300"
            style={{
              fontSize: '20px',
              transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            chevron_left
          </span>
        </button>
      </div>
    </aside>
  )
}
