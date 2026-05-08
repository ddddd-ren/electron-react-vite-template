import { useState, useEffect } from 'react'

interface ProxyConfig {
  protocol: 'http' | 'socks5'
  host: string
  port: string
}

export default function ProxySettings() {
  const [protocol, setProtocol] = useState<'http' | 'socks5'>('http')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [isSet, setIsSet] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Load saved proxy
    window.electronAPI.proxyGet().then((proxy: ProxyConfig | null) => {
      if (proxy) {
        setProtocol(proxy.protocol || 'http')
        setHost(proxy.host || '')
        setPort(proxy.port || '')
        setIsSet(true)
      }
    }).catch((e: unknown) => {
      console.error('Failed to load proxy settings:', e)
    })
  }, [])

  const handleSetProxy = async () => {
    if (!host || !port) return
    try {
      await window.electronAPI.proxySet({ protocol, host, port })
      setIsSet(true)
      setMessage('代理设置成功')
    } catch (e: any) {
      setMessage(`设置失败: ${e.message}`)
    }
  }

  const handleClearProxy = async () => {
    try {
      await window.electronAPI.proxyClear()
      setIsSet(false)
      setHost('')
      setPort('')
      setMessage('代理已清除')
    } catch (e: any) {
      setMessage(`清除失败: ${e.message}`)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">代理设置</h3>

      <div className="space-y-2">
        <div className="flex gap-2">
          <select
            value={protocol}
            onChange={e => setProtocol(e.target.value as 'http' | 'socks5')}
            className="px-3 py-2 bg-[var(--bg-primary)] border border-gray-600 rounded text-sm"
          >
            <option value="http">HTTP</option>
            <option value="socks5">SOCKS5</option>
          </select>
          <input
            type="text"
            value={host}
            onChange={e => setHost(e.target.value)}
            placeholder="代理地址 (127.0.0.1)"
            className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-gray-600 rounded text-sm"
          />
          <input
            type="text"
            value={port}
            onChange={e => setPort(e.target.value)}
            placeholder="端口"
            className="w-24 px-3 py-2 bg-[var(--bg-primary)] border border-gray-600 rounded text-sm"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSetProxy}
            disabled={!host || !port}
            className="flex-1 px-4 py-2 bg-blue-600 rounded text-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {isSet ? '更新代理' : '设置代理'}
          </button>
          {isSet && (
            <button
              onClick={handleClearProxy}
              className="px-4 py-2 bg-red-600 rounded text-sm hover:bg-red-500"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {isSet && (
        <p className="text-sm text-green-400">
          当前代理: {protocol}://{host}:{port}
        </p>
      )}

      {message && (
        <p className={`text-sm ${message.includes('成功') || message.includes('清除') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
