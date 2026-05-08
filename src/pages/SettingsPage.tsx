import { useState, useEffect } from 'react'
import BangumiLogin from '../components/BangumiLogin'
import WebDavSettings from '../components/WebDavSettings'
import ProxySettings from '../components/ProxySettings'
import LocalFolderSettings from '../components/LocalFolderSettings'

interface ScraperRule {
  name: string
  baseURL: string
  searchURL: string
  useWebview?: boolean
  enabled?: boolean
  [key: string]: any
}

export default function SettingsPage() {
  const [rules, setRules] = useState<ScraperRule[]>([])
  const [saved, setSaved] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importError, setImportError] = useState('')

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.scraperGetSources().then((r: ScraperRule[]) => {
      if (r != null) setRules(r)
    })
  }, [])

  const saveSettings = async () => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.scraperSaveSources(rules)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }

  const toggleRule = (idx: number) => {
    const next = [...rules]
    next[idx].enabled = next[idx].enabled === false ? true : false
    setRules(next)
  }

  const removeRule = (idx: number) => {
    setRules(rules.filter((_, i) => i !== idx))
  }

  const importRule = () => {
    setImportError('')
    try {
      const parsed = JSON.parse(importJson)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      for (const r of arr) {
        if (!r.name || !r.baseURL) {
          setImportError('规则必须包含 name 和 baseURL 字段')
          return
        }
        if (!r.searchURL) {
          setImportError('规则必须包含 searchURL 字段（用 @keyword 作为搜索占位符）')
          return
        }
      }
      setRules([...rules, ...arr.map((r: ScraperRule) => ({ ...r, enabled: true }))])
      setImportJson('')
      setShowImport(false)
    } catch {
      setImportError('JSON 格式错误')
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6 flex items-center gap-2 animate-fade-in">
        <span className="material-symbols-rounded text-primary-400" style={{ fontSize: '26px' }}>settings</span>
        设置
      </h1>

      {/* 在线源管理 */}
      <section className="mb-8 animate-slide-up">
        <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>cloud</span>
          在线源管理
        </h2>

        <div className="space-y-2 mb-4">
          {rules.map((rule, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]"
            >
              <button onClick={() => toggleRule(i)} className="shrink-0">
                <div className={`w-8 h-5 rounded-full transition-colors relative ${rule.enabled !== false ? 'bg-primary-600' : 'bg-[var(--bg-tertiary)]'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${rule.enabled !== false ? 'left-3.5' : 'left-0.5'}`} />
                </div>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)] truncate">{rule.name}</p>
                <p className="text-[11px] text-[var(--text-muted)] truncate">{rule.baseURL}</p>
              </div>
              <button
                onClick={() => removeRule(i)}
                className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>delete</span>
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          {!showImport ? (
            <button
              onClick={() => setShowImport(true)}
              className="flex-1 p-3 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-primary-500/50 hover:text-primary-400 text-xs transition-all"
            >
              + 导入规则（JSON）
            </button>
          ) : (
            <div className="flex-1 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <p className="text-xs text-[var(--text-muted)] mb-2">
                粘贴规则 JSON（单个或数组）。必须包含 name、baseURL、searchURL（@keyword 为搜索占位符）。
              </p>
              <textarea
                value={importJson}
                onChange={(e) => { setImportJson(e.target.value); setImportError('') }}
                placeholder={`{
  "name": "示例源",
  "baseURL": "https://example.com",
  "searchURL": "https://example.com/search?wd=@keyword",
  "useWebview": false,
  "searchList": ".video-item",
  "searchName": ".title a",
  "searchNameAttr": "title",
  "searchResult": ".title a",
  "searchResultAttr": "href"
}`}
                className="w-full h-40 p-3 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-primary-500/50 font-mono resize-none"
              />
              {importError && <p className="text-xs text-red-400 mt-2">{importError}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={importRule}
                  className="px-4 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  导入
                </button>
                <button
                  onClick={() => { setShowImport(false); setImportJson(''); setImportError('') }}
                  className="px-4 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded-lg text-xs transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
          <button
            onClick={async () => {
              if (window.electronAPI) {
                const r = await window.electronAPI.scraperResetSources()
                setRules(r)
              }
            }}
            className="shrink-0 px-4 py-3 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-primary-500/50 hover:text-primary-400 text-xs transition-all"
          >
            恢复默认源
          </button>
        </div>
      </section>

      {/* 本地文件夹 */}
      <section className="mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>folder</span>
          本地文件夹
        </h2>
        <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
          <LocalFolderSettings />
        </div>
      </section>

      {/* Bangumi */}
      <section className="mb-8 animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>sync</span>
          Bangumi 同步
        </h2>
        <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
          <BangumiLogin />
        </div>
      </section>

      {/* WebDAV */}
      <section className="mb-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>cloud_sync</span>
          WebDAV 同步
        </h2>
        <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
          <WebDavSettings />
        </div>
      </section>

      {/* 代理 */}
      <section className="mb-8 animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>vpn_lock</span>
          代理设置
        </h2>
        <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
          <ProxySettings />
        </div>
      </section>

      {/* 保存 */}
      <div className="flex items-center gap-3 animate-slide-up" style={{ animationDelay: '0.3s' }}>
        <button
          onClick={saveSettings}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-medium transition-all active:scale-95"
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
            {saved ? 'check' : 'save'}
          </span>
          {saved ? '已保存' : '保存设置'}
        </button>
      </div>

      {/* 关于 */}
      <section className="mt-12 pt-6 border-t border-[var(--border)] animate-slide-up" style={{ animationDelay: '0.35s' }}>
        <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3">关于</h2>
        <div className="space-y-2 text-xs text-[var(--text-muted)]">
          <p>Anime Player V2 v1.4.0</p>
          <p>基于 Electron + React + Vite 构建的桌面动漫播放器</p>
        </div>
      </section>
    </div>
  )
}
