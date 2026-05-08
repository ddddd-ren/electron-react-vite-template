export default function TitleBar() {
  const isElectron = !!window.electronAPI

  const handleMinimize = () => window.electronAPI?.minimize()
  const handleMaximize = () => window.electronAPI?.maximize()
  const handleClose = () => window.electronAPI?.close()

  return (
    <div className="h-10 flex items-center justify-between bg-[var(--bg-secondary)] border-b border-[var(--border)] select-none shrink-0 drag-region">
      {/* 左侧：Logo + 标题 */}
      <div className="flex items-center gap-2 px-4 drag-region h-full">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
          <span className="material-symbols-rounded text-white" style={{ fontSize: '14px' }}>play_arrow</span>
        </div>
        <span className="text-sm font-medium text-[var(--text-secondary)]">Anime Player</span>
      </div>

      {/* 右侧：窗口控制按钮 */}
      {isElectron && (
        <div className="flex items-center h-full no-drag">
          <button
            onClick={handleMinimize}
            className="h-full px-3 hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="5.5" width="8" height="1" rx="0.5" fill="currentColor" className="text-[var(--text-muted)]"/>
            </svg>
          </button>
          <button
            onClick={handleMaximize}
            className="h-full px-3 hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1" className="text-[var(--text-muted)]"/>
            </svg>
          </button>
          <button
            onClick={handleClose}
            className="h-full px-3 hover:bg-red-500/80 transition-colors flex items-center justify-center group"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-[var(--text-muted)] group-hover:text-white"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
