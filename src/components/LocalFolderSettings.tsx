import { useState } from 'react'
import { useStore } from '../store/useStore'

export default function LocalFolderSettings() {
  const { localFolders, addLocalFolder, removeLocalFolder } = useStore()
  const isElectron = !!window.electronAPI
  const [newPath, setNewPath] = useState('')

  const handleAddFolder = async () => {
    if (isElectron) {
      const folder = await window.electronAPI.openFolder()
      if (folder) {
        addLocalFolder(folder)
      }
    }
  }

  const handleAddManual = () => {
    const p = newPath.trim()
    if (p && !localFolders.includes(p)) {
      addLocalFolder(p)
      setNewPath('')
    }
  }

  return (
    <div>
      {localFolders.length > 0 && (
        <div className="space-y-2 mb-3">
          {localFolders.map((folder) => (
            <div
              key={folder}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)]"
            >
              <span className="material-symbols-rounded text-primary-400" style={{ fontSize: '18px' }}>folder</span>
              <span className="flex-1 text-xs text-[var(--text-secondary)] truncate">{folder}</span>
              <button
                onClick={() => removeLocalFolder(folder)}
                className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>delete</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {localFolders.length === 0 && (
        <p className="text-xs text-[var(--text-muted)] mb-3">暂无已添加的本地文件夹</p>
      )}

      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
          placeholder="手动输入路径，如 D:\Anime"
          className="flex-1 h-8 px-3 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-primary-500/50"
        />
        <button
          onClick={handleAddManual}
          className="px-3 h-8 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-xs transition-colors"
        >
          添加
        </button>
      </div>

      {isElectron && (
        <button
          onClick={handleAddFolder}
          className="flex items-center gap-2 px-3 py-2 text-xs text-primary-400 hover:text-primary-300 transition-colors"
        >
          <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>folder_open</span>
          浏览选择文件夹
        </button>
      )}
    </div>
  )
}
