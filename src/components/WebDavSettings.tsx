import { useState } from 'react'

export default function WebDavSettings() {
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [message, setMessage] = useState('')

  const handleConnect = async () => {
    if (!url) return
    setIsConnecting(true)
    setMessage('')
    try {
      await window.electronAPI.webdavInit({ url, username, password })
      setIsConnected(true)
      setMessage('连接成功')
    } catch (e: any) {
      setMessage(`连接失败: ${e.message}`)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleSyncHistory = async () => {
    setIsSyncing(true)
    setMessage('')
    try {
      await window.electronAPI.webdavSyncHistory()
      setMessage('历史记录同步完成')
    } catch (e: any) {
      setMessage(`同步失败: ${e.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSyncCollectibles = async () => {
    setIsSyncing(true)
    setMessage('')
    try {
      await window.electronAPI.webdavSyncCollectibles()
      setMessage('收藏同步完成')
    } catch (e: any) {
      setMessage(`同步失败: ${e.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleUploadHistory = async () => {
    setIsSyncing(true)
    setMessage('')
    try {
      await window.electronAPI.webdavUpdateHistory()
      setMessage('历史记录上传完成')
    } catch (e: any) {
      setMessage(`上传失败: ${e.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleUploadCollectibles = async () => {
    setIsSyncing(true)
    setMessage('')
    try {
      await window.electronAPI.webdavUpdateCollectibles()
      setMessage('收藏上传完成')
    } catch (e: any) {
      setMessage(`上传失败: ${e.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">WebDAV 同步</h3>

      {/* Connection form */}
      <div className="space-y-2">
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="WebDAV URL (https://dav.example.com/dav/)"
          className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-gray-600 rounded text-sm"
          disabled={isConnected}
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="用户名"
            className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-gray-600 rounded text-sm"
            disabled={isConnected}
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="密码"
            className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-gray-600 rounded text-sm"
            disabled={isConnected}
          />
        </div>

        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting || !url}
            className="w-full px-4 py-2 bg-blue-600 rounded text-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {isConnecting ? '连接中...' : '连接'}
          </button>
        ) : (
          <div className="text-sm text-green-400">已连接</div>
        )}
      </div>

      {/* Sync buttons */}
      {isConnected && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handleSyncHistory}
              disabled={isSyncing}
              className="flex-1 px-4 py-2 bg-blue-600 rounded text-sm hover:bg-blue-500 disabled:opacity-50"
            >
              {isSyncing ? '同步中...' : '同步历史'}
            </button>
            <button
              onClick={handleUploadHistory}
              disabled={isSyncing}
              className="flex-1 px-4 py-2 bg-gray-600 rounded text-sm hover:bg-gray-500 disabled:opacity-50"
            >
              上传历史
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSyncCollectibles}
              disabled={isSyncing}
              className="flex-1 px-4 py-2 bg-blue-600 rounded text-sm hover:bg-blue-500 disabled:opacity-50"
            >
              {isSyncing ? '同步中...' : '同步收藏'}
            </button>
            <button
              onClick={handleUploadCollectibles}
              disabled={isSyncing}
              className="flex-1 px-4 py-2 bg-gray-600 rounded text-sm hover:bg-gray-500 disabled:opacity-50"
            >
              上传收藏
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-sm ${message.includes('成功') || message.includes('完成') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
