import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { useScraperStore } from '../store/useScraperStore'
import type { HomeItem, SearchResult } from '../types/scraper'

export default function SourcePage() {
  const { searchQuery, setSearchQuery } = useStore()
  const store = useScraperStore()
  const [query, setQuery] = useState('')
  const debounceRef = useRef<NodeJS.Timeout>()
  const lastSearchRef = useRef('')

  // 从 Bangumi 首页跳转时自动搜索
  useEffect(() => {
    if (searchQuery) {
      setQuery(searchQuery)
      setSearchQuery('')
    }
  }, [])

  // 输入防抖自动搜索
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const kw = query.trim()
    if (!kw || kw === lastSearchRef.current) return
    debounceRef.current = setTimeout(() => {
      lastSearchRef.current = kw
      store.search(kw)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => { store.loadHome() }, [])

  const doSearch = () => {
    const kw = query.trim()
    if (!kw) return
    lastSearchRef.current = kw
    store.search(kw)
  }

  const filteredSources = store.sourceResults.filter(s => store.enabledSources.has(s.sourceName))

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* 返回按钮 */}
      {store.view !== 'home' && (
        <div className="max-w-2xl mx-auto mb-3 animate-fade-in">
          <button
            onClick={() => {
              if (store.view === 'detail' && store.searchResults.length > 0) {
                store.setView('search')
              } else {
                store.setView('home')
                store.loadHome()
              }
            }}
            className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-primary-400 transition-colors"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>arrow_back</span>
            {store.view === 'detail' && store.searchResults.length > 0 ? '返回搜索结果' : '返回首页'}
          </button>
        </div>
      )}

      {/* 搜索栏 */}
      <div className="max-w-2xl mx-auto mb-6 animate-fade-in">
        <div className="relative">
          <span className="material-symbols-rounded absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '22px' }}>
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="搜索动漫..."
            className="w-full h-12 pl-12 pr-24 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-primary-500/50 transition-all"
          />
          <button
            onClick={() => doSearch()}
            disabled={store.loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all"
          >
            搜索
          </button>
        </div>

        {/* 面包屑 */}
        {store.view !== 'home' && (
          <div className="flex items-center gap-2 mt-3 text-xs text-[var(--text-muted)]">
            <button onClick={() => { store.setView('home'); store.loadHome() }} className="hover:text-primary-400 transition-colors">首页</button>
            {store.view === 'detail' && (
              <>
                <span>/</span>
                <button onClick={() => store.setView('search')} className="hover:text-primary-400 transition-colors">搜索结果</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 加载中 */}
      {store.loading && (
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton h-48 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* 错误 */}
      {store.error && !store.loading && (
        <div className="max-w-2xl mx-auto text-center py-16">
          <span className="material-symbols-rounded text-red-400" style={{ fontSize: '48px' }}>error</span>
          <p className="text-[var(--text-muted)] mt-3">{store.error}</p>
          <button onClick={() => { store.loadHome() }} className="mt-3 px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm">重试</button>
        </div>
      )}

      {/* 源选择器 */}
      {!store.loading && store.view === 'home' && !store.error && store.sourceResults.length > 0 && (
        <div className="max-w-5xl mx-auto mb-6 flex flex-wrap gap-2 animate-fade-in">
          {store.sourceResults.map((source) => (
            <button
              key={source.sourceName}
              onClick={() => store.toggleSource(source.sourceName)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                store.enabledSources.has(source.sourceName)
                  ? 'bg-primary-600 text-white'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)]'
              }`}
            >
              {source.sourceName}
            </button>
          ))}
        </div>
      )}

      {/* 首页视图 */}
      {!store.loading && store.view === 'home' && !store.error && filteredSources.map((source, si) => (
        <div key={si} className="max-w-5xl mx-auto mb-10 animate-slide-up">
          <h2 className="text-sm font-medium text-[var(--text-muted)] mb-4 flex items-center gap-2">
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>cloud</span>
            {source.sourceName}
          </h2>
          {source.sections.map((section, ssi) => (
            <div key={ssi} className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">{section.title}</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {section.items.map((item, ii) => (
                  <VideoCard key={ii} item={item} onClick={() => store.openDetail(item.url)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* 搜索结果 */}
      {!store.loading && store.view === 'search' && !store.error && (
        <div className="max-w-2xl mx-auto animate-slide-up">
          <p className="text-sm text-[var(--text-muted)] mb-4">找到 {store.searchResults.length} 个结果</p>
          {Object.entries(
            store.searchResults.reduce((acc, item) => {
              const src = item.sourceName || '其他'
              ;(acc[src] ||= []).push(item)
              return acc
            }, {} as Record<string, SearchResult[]>)
          ).map(([source, items]) => (
            <div key={source} className="mb-6">
              <h3 className="text-xs font-medium text-primary-400 mb-2 flex items-center gap-1.5">
                <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>cloud</span>
                {source} ({items.length})
              </h3>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => store.openDetail(item.url)}
                    className="flex items-center gap-4 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-primary-500/30 cursor-pointer transition-all group"
                  >
                    <div className="w-16 h-12 rounded-lg overflow-hidden bg-[var(--bg-tertiary)] shrink-0">
                      {item.cover ? (
                        <img src={item.cover} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-rounded text-[var(--text-muted)]" style={{ fontSize: '20px' }}>movie</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-primary-400">{item.title}</p>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">
                        {item.episode} {item.tag}
                      </p>
                    </div>
                    <span className="material-symbols-rounded text-[var(--text-muted)] opacity-0 group-hover:opacity-100" style={{ fontSize: '18px' }}>chevron_right</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 详情视图 */}
      {!store.loading && store.view === 'detail' && store.detail && !store.error && (
        <div className="max-w-3xl mx-auto animate-slide-up">
          {/* 动漫信息 */}
          <div className="flex gap-4 mb-6">
            {store.detail.cover && (
              <div className="w-32 h-44 rounded-xl overflow-hidden bg-[var(--bg-tertiary)] shrink-0">
                <img src={store.detail.cover} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{store.detail.title}</h2>
              {store.detail.desc && <p className="text-xs text-[var(--text-muted)] line-clamp-3">{store.detail.desc}</p>}
            </div>
          </div>

          {/* 播放源选择 */}
          {store.detail.roads.length > 1 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {store.detail.roads.map((road, i) => (
                <button
                  key={i}
                  onClick={() => store.setSelectedRoad(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    store.selectedRoad === i
                      ? 'bg-primary-600 text-white'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)] hover:border-primary-500/30'
                  }`}
                >
                  {road.name}
                </button>
              ))}
            </div>
          )}

          {/* 剧集列表 */}
          {store.detail.roads[store.selectedRoad] && (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                {store.detail.roads[store.selectedRoad].name} · 共 {store.detail.roads[store.selectedRoad].episodes.length} 集
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {store.detail.roads[store.selectedRoad].episodes.map((ep, i) => (
                  <button
                    key={i}
                    onClick={() => store.handlePlay(ep)}
                    className="px-2 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-primary-500/50 hover:text-primary-400 hover:bg-primary-600/10 transition-all truncate"
                  >
                    {ep.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function VideoCard({ item, onClick }: { item: HomeItem; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] hover:border-primary-500/30 cursor-pointer transition-all group"
    >
      <div className="aspect-[3/4] relative bg-[var(--bg-tertiary)] overflow-hidden">
        {item.cover ? (
          <img
            src={item.cover}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-rounded text-[var(--text-muted)]" style={{ fontSize: '36px' }}>movie</span>
          </div>
        )}
        {item.tag && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-primary-600/90 text-white text-[10px] font-medium">
            {item.tag}
          </span>
        )}
        {item.episode && (
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
            {item.episode}
          </span>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-medium text-[var(--text-primary)] truncate group-hover:text-primary-400 transition-colors">
          {item.title}
        </p>
      </div>
    </div>
  )
}
