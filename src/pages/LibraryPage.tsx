import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import type { MediaItem } from '../types/common'
import { formatBytes } from '../utils'

interface LocalFile {
  name: string
  path: string
  ext: string
  size: number
  mtime: number
}

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function LibraryPage() {
  const { localFolders, addLocalFolder, removeLocalFolder, playMedia, _loadFolders } = useStore()
  const [files, setFiles] = useState<LocalFile[]>([])
  const [loading, setLoading] = useState(false)
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)

  const isElectron = !!window.electronAPI

  // 挂载时加载已保存的文件夹，有文件夹时自动扫描第一个
  useEffect(() => {
    _loadFolders().then(() => {
      const folders = useStore.getState().localFolders
      if (folders.length > 0 && !currentFolder) {
        loadFolder(folders[0])
      }
    })
  }, [])

  const openFolder = async () => {
    if (!isElectron) return
    const folder = await window.electronAPI.openFolder()
    if (folder) {
      addLocalFolder(folder)
      loadFolder(folder)
    }
  }

  const openFiles = async () => {
    if (!isElectron) return
    const filePaths = await window.electronAPI.openFiles()
    if (filePaths?.length) {
      const items: MediaItem[] = filePaths.map((fp: string) => ({
        id: `local:${fp}`,
        title: fp.split(/[/\\]/).pop() || '未知',
        source: 'local',
        path: fp,
      }))
      // 直接播放第一个文件
      if (items.length === 1) {
        playMedia(items[0])
      }
    }
  }

  const loadFolder = async (folder: string) => {
    setLoading(true)
    setCurrentFolder(folder)
    try {
      if (isElectron) {
        const result = await window.electronAPI.readDir(folder)
        if (result.error) {
          console.error('Read dir error:', result.error)
        }
        setFiles(result.files || [])
      }
    } catch (e) {
      console.error('Load folder failed:', e)
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  const playFile = (file: LocalFile) => {
    playMedia({
      id: `local:${file.path}`,
      title: file.name,
      source: 'local',
      path: file.path,
    })
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* 头部操作 */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <span className="material-symbols-rounded text-primary-400" style={{ fontSize: '26px' }}>video_library</span>
          媒体库
        </h1>
        <div className="flex gap-2">
          <button
            onClick={openFiles}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] hover:border-primary-500/30 text-[var(--text-secondary)] rounded-xl text-sm transition-all"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>video_file</span>
            打开文件
          </button>
          <button
            onClick={openFolder}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-medium transition-all"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>folder_open</span>
            打开文件夹
          </button>
        </div>
      </div>

      {/* 已添加的文件夹 */}
      {localFolders.length > 0 && (
        <div className="mb-6 animate-slide-up">
          <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3">已添加的文件夹</h2>
          <div className="flex flex-wrap gap-2">
            {localFolders.map((folder) => (
              <div
                key={folder}
                onClick={() => loadFolder(folder)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                  currentFolder === folder
                    ? 'bg-primary-600/15 border-primary-500/30 text-primary-400'
                    : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-secondary)] hover:border-primary-500/20'
                }`}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>folder</span>
                <span className="text-xs truncate max-w-[200px]">{folder.split(/[/\\]/).pop()}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeLocalFolder(folder) }}
                  className="ml-1 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>close</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 文件统计 */}
      {!loading && files.length > 0 && currentFolder && (
        <div className="mb-4 flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span>共 {files.length} 个视频文件</span>
          <span>总大小 {formatBytes(files.reduce((sum, f) => sum + f.size, 0))}</span>
        </div>
      )}

      {/* 文件列表 */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-16 w-full" />)}
        </div>
      )}

      {!loading && files.length > 0 && (
        <div className="space-y-1 animate-slide-up">
          {files.map((file) => (
            <div
              key={file.path}
              onClick={() => playFile(file)}
              className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-[var(--bg-hover)] cursor-pointer transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-600/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-rounded text-primary-400" style={{ fontSize: '20px' }}>play_circle</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] truncate transition-colors">
                  {file.name}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-[var(--text-muted)]">{file.ext.toUpperCase().replace('.', '')}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{formatBytes(file.size)}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{formatTime(file.mtime)}</span>
                </div>
              </div>
              <span className="text-xs text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                播放
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && files.length === 0 && currentFolder && (
        <div className="text-center py-16 animate-fade-in">
          <span className="material-symbols-rounded text-[var(--text-muted)]" style={{ fontSize: '48px' }}>folder_off</span>
          <p className="text-[var(--text-muted)] mt-3 text-sm">该文件夹中没有找到视频文件</p>
          <p className="text-[var(--text-muted)] mt-1 text-xs">支持 MP4、MKV、AVI、FLV、WMV、MOV、TS 等格式</p>
        </div>
      )}

      {!loading && files.length === 0 && !currentFolder && localFolders.length === 0 && (
        <div className="text-center py-20 animate-fade-in">
          <span className="material-symbols-rounded text-[var(--text-muted)]" style={{ fontSize: '64px' }}>video_library</span>
          <p className="text-[var(--text-muted)] mt-4 text-sm">打开本地文件或文件夹开始播放</p>
          <p className="text-[var(--text-muted)] mt-1 text-xs">支持 MP4、MKV、AVI、FLV、WMV、MOV、TS 等常见格式</p>
        </div>
      )}
    </div>
  )
}
