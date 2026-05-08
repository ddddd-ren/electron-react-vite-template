import { useState, useEffect } from 'react'

interface VersionInfo {
  version: string
  date: string
  changes: string[]
}

interface UpdateDialogData {
  currentVersion: string
  history: VersionInfo[]
}

export default function UpdateDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<UpdateDialogData | null>(null)

  useEffect(() => {
    // 监听主进程发来的更新日志事件
    if (window.electronAPI?.onShowUpdateDialog) {
      const unsub = window.electronAPI.onShowUpdateDialog((updateData: UpdateDialogData) => {
        setData(updateData)
        setIsOpen(true)
      })
      return unsub
    }
  }, [])

  const handleClose = () => {
    setIsOpen(false)
  }

  if (!isOpen || !data) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-[var(--bg-secondary)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                Anime Player V2
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                当前版本: v{data.currentVersion}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center">
              <span className="material-symbols-rounded text-primary-400" style={{ fontSize: '28px' }}>
                new_releases
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {data.history.map((version, idx) => (
            <div key={idx} className={idx > 0 ? 'mt-6 pt-6 border-t border-[var(--border)]' : ''}>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-1 bg-primary-600/20 rounded-lg text-xs font-medium text-primary-400">
                  v{version.version}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {version.date}
                </span>
              </div>
              <ul className="space-y-1.5">
                {version.changes.map((change, changeIdx) => (
                  <li key={changeIdx} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="material-symbols-rounded text-primary-400 mt-0.5" style={{ fontSize: '16px' }}>
                      check_circle
                    </span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end">
          <button
            onClick={handleClose}
            className="px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-medium transition-all active:scale-95"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  )
}
