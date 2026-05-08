import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { useBangumiStore } from '../store/useBangumiStore'

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export default function HomePage() {
  const { recentPlay, playMedia, setPage, searchQuery, setSearchQuery } = useStore()
  const { trending, calendar, isLoadingCalendar, fetchTrending, fetchCalendar } = useBangumiStore()
  const [bannerIdx, setBannerIdx] = useState(0)
  const bannerTimerRef = useRef<NodeJS.Timeout>()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [activeDay, setActiveDay] = useState(() => {
    const d = new Date().getDay()
    return d === 0 ? 6 : d - 1
  })

  useEffect(() => {
    fetchTrending()
    fetchCalendar()
  }, [])

  // Banner 自动轮播
  useEffect(() => {
    if (recentPlay.length < 2) return
    bannerTimerRef.current = setInterval(() => {
      setBannerIdx(prev => (prev + 1) % Math.min(recentPlay.length, 5))
    }, 5000)
    return () => { if (bannerTimerRef.current) clearInterval(bannerTimerRef.current) }
  }, [recentPlay.length])

  const handleSearch = (q?: string) => {
    const keyword = (q || searchQuery).trim()
    if (keyword) {
      setSearchQuery(keyword)
      setPage('source')
    }
  }

  const openBangumi = (subject: any) => {
    setSearchQuery(subject.nameCn || subject.name)
    setPage('source')
  }

  const bannerItems = recentPlay.slice(0, 5)

  // 当前星期的番剧
  const todayItems = calendar[activeDay]?.items || []

  return (
    <div className="h-full overflow-y-auto">
      {/* 顶部搜索栏 */}
      <div className="sticky top-0 z-10 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border)] px-6 py-3">
        <div className="max-w-3xl mx-auto relative">
          <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '20px' }}>search</span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索动漫..."
            className="w-full h-10 pl-10 pr-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-primary-500/50 transition-all"
          />
          <button
            onClick={() => handleSearch()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-xs font-medium transition-all"
          >
            搜索
          </button>
        </div>
      </div>

      <div className="px-6 py-4 space-y-8">
        {/* Banner 轮播 */}
        {bannerItems.length > 0 && (
          <section className="animate-fade-in">
            <div className="relative rounded-2xl overflow-hidden h-56 md:h-64">
              {bannerItems.map((item, idx) => (
                <div
                  key={item.id}
                  className={`absolute inset-0 transition-opacity duration-700 ${idx === bannerIdx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-card)] to-transparent">
                    {item.cover ? (
                      <img src={item.cover} alt="" className="w-full h-full object-cover opacity-40" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary-900/60 via-purple-900/40 to-dark-700" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)] via-[var(--bg-primary)]/70 to-transparent" />
                  <div className="relative z-10 h-full flex flex-col justify-center px-8">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2 max-w-md truncate">{item.title}</h2>
                    <p className="text-sm text-[var(--text-muted)] mb-4">最近播放</p>
                    <button
                      onClick={() => playMedia(item)}
                      className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-medium transition-all w-fit active:scale-95"
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>play_arrow</span>
                      继续播放
                    </button>
                  </div>
                </div>
              ))}
              {bannerItems.length > 1 && (
                <div className="absolute bottom-3 right-4 flex gap-1.5 z-20">
                  {bannerItems.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setBannerIdx(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${idx === bannerIdx ? 'bg-primary-400 w-5' : 'bg-white/30 hover:bg-white/50'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 无最近播放时的 Hero */}
        {recentPlay.length === 0 && (
          <section className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary-900/40 via-dark-700 to-purple-900/30 p-8 animate-fade-in">
            <div className="relative z-10">
              <h1 className="text-3xl font-bold mb-2">
                <span className="gradient-text">Anime Player</span>
              </h1>
              <p className="text-[var(--text-secondary)] text-base mb-6 max-w-md">
                本地视频播放 · 在线聚合搜索 · 进度自动记忆
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPage('source')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-medium transition-all hover:shadow-lg hover:shadow-primary-600/25 active:scale-95"
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>cloud</span>
                  在线源
                </button>
                <button
                  onClick={() => setPage('library')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--bg-hover)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-xl text-sm font-medium transition-all border border-[var(--border)] active:scale-95"
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>folder_open</span>
                  打开文件
                </button>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
          </section>
        )}

        {/* ═══ 放送时间表（Bangumi 日历） ═══ */}
        {calendar.length > 0 && (
          <section className="animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <span className="material-symbols-rounded text-orange-400" style={{ fontSize: '20px' }}>calendar_today</span>
                今日放送
              </h2>
              <div className="flex gap-1">
                {WEEKDAYS.map((day, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveDay(i)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      activeDay === i
                        ? 'bg-primary-600 text-white'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            {isLoadingCalendar ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-48 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {todayItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => openBangumi(item)}
                    className="group cursor-pointer animate-scale-in"
                  >
                    <div className="aspect-[3/4] rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] group-hover:border-primary-500/30 transition-all duration-300 relative">
                      {item.images?.large || item.images?.medium ? (
                        <img src={item.images.large || item.images.medium} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-900/20 to-purple-900/20">
                          <span className="material-symbols-rounded text-[var(--text-muted)]" style={{ fontSize: '36px' }}>movie</span>
                        </div>
                      )}
                      {item.ratingScore > 0 && (
                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-yellow-400 text-[10px] font-medium">
                          {item.ratingScore.toFixed(1)}
                        </span>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                        <div className="px-3 py-1.5 rounded-lg bg-primary-600/90 text-white text-xs font-medium">
                          搜索播放
                        </div>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--text-secondary)] truncate group-hover:text-[var(--text-primary)] transition-colors">
                      {item.nameCn || item.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══ 热门番剧（Bangumi Trending） ═══ */}
        {trending.length > 0 && (
          <section className="animate-slide-up" style={{ animationDelay: '0.05s' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <span className="material-symbols-rounded text-red-400" style={{ fontSize: '20px' }}>trending_up</span>
                热门番剧
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {trending.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openBangumi(item)}
                  className="group cursor-pointer animate-scale-in"
                >
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] group-hover:border-primary-500/30 transition-all duration-300 relative">
                    {item.image ? (
                      <img src={item.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-900/20 to-purple-900/20">
                        <span className="material-symbols-rounded text-[var(--text-muted)]" style={{ fontSize: '36px' }}>movie</span>
                      </div>
                    )}
                    {item.rating?.score && (
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-yellow-400 text-[10px] font-medium">
                        {item.rating.score.toFixed(1)}
                      </span>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="px-3 py-1.5 rounded-lg bg-primary-600/90 text-white text-xs font-medium">
                        搜索播放
                      </div>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)] truncate group-hover:text-[var(--text-primary)] transition-colors">
                    {item.nameCn || item.name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 最近播放 */}
        {recentPlay.length > 0 && (
          <section className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <span className="material-symbols-rounded text-primary-400" style={{ fontSize: '20px' }}>history</span>
                最近播放
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {recentPlay.slice(0, 12).map((item) => (
                <div
                  key={item.id}
                  onClick={() => playMedia(item)}
                  className="group cursor-pointer animate-scale-in"
                >
                  <div className="aspect-video rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] group-hover:border-primary-500/30 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-primary-500/10 relative">
                    {item.cover ? (
                      <img src={item.cover} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-rounded text-[var(--text-muted)]" style={{ fontSize: '32px' }}>movie</span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="w-9 h-9 rounded-full bg-primary-600/90 flex items-center justify-center">
                        <span className="material-symbols-rounded text-white" style={{ fontSize: '18px' }}>play_arrow</span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)] truncate group-hover:text-[var(--text-primary)] transition-colors">
                    {item.title}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 快捷入口 */}
        <section className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <span className="material-symbols-rounded text-orange-400" style={{ fontSize: '20px' }}>bolt</span>
            快捷入口
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: 'folder_open', label: '打开本地文件', desc: '选择本地视频文件播放', action: () => setPage('library'), color: 'text-green-400 bg-green-500/10' },
              { icon: 'cloud', label: '在线源', desc: '从多个源搜索动漫资源', action: () => setPage('source'), color: 'text-blue-400 bg-blue-500/10' },
              { icon: 'tune', label: '设置', desc: '管理播放源和应用设置', action: () => setPage('settings'), color: 'text-purple-400 bg-purple-500/10' },
            ].map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-primary-500/30 hover:bg-[var(--bg-hover)] transition-all duration-300 text-left group"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${item.color} transition-colors`}>
                  <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>{item.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
