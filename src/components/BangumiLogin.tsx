import { useState } from 'react'
import { useBangumiStore } from '../store/useBangumiStore'

export default function BangumiLogin() {
  const { accessToken, username, isLoggedIn, setAccessToken } = useBangumiStore()
  const [token, setToken] = useState(accessToken)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!token.trim()) return
    setIsVerifying(true)
    setError('')
    try {
      const success = await setAccessToken(token)
      if (!success) {
        setError('Token 无效，请检查后重试')
      }
    } catch (e: any) {
      setError(e.message || '验证失败')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleLogout = () => {
    setToken('')
    useBangumiStore.setState({ accessToken: '', username: '', isLoggedIn: false })
  }

  if (isLoggedIn) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">已登录: <strong>{username}</strong></span>
          <button
            onClick={handleLogout}
            className="text-xs px-3 py-1 bg-red-600 rounded hover:bg-red-500"
          >
            退出
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-400">
        访问 <a href="https://bgm.tv/settings/tokens" target="_blank" rel="noopener" className="text-blue-400 hover:underline">bgm.tv 设置</a> 获取 Access Token
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="输入 Bangumi Access Token..."
          className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-gray-600 rounded text-sm"
        />
        <button
          onClick={handleLogin}
          disabled={isVerifying}
          className="px-4 py-2 bg-blue-600 rounded text-sm hover:bg-blue-500 disabled:opacity-50"
        >
          {isVerifying ? '验证中...' : '登录'}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
