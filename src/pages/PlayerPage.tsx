import { useVideoPlayer } from '../hooks/useVideoPlayer'
import { useAudioTranscode } from '../hooks/useAudioTranscode'
import { useSubtitles } from '../hooks/useSubtitles'
import { usePlayerKeyboard } from '../hooks/usePlayerKeyboard'
import { useAnime4k } from '../hooks/useAnime4k'
import type { MediaItem } from '../types/common'
import { Anime4KMode } from '../lib/anime4k'
import { SPEED_LIST, SPEED_BOOST } from '../constants'

interface Props {
  media: MediaItem | null
}

export default function PlayerPage({ media }: Props) {
  const { transcodeUrl, audioChecking } = useAudioTranscode(media)
  const player = useVideoPlayer(media, transcodeUrl, audioChecking)
  const { subtitles, activeSubIdx, setActiveSubIdx } = useSubtitles(media)
  const { anime4kEnabled, anime4kMode, showAnime4kMenu, setShowAnime4kMenu, toggleAnime4k, setAnime4kModeAndSync } = useAnime4k(player.videoRef, player.showToast)

  usePlayerKeyboard({
    togglePlay: player.togglePlay,
    toggleFullscreen: player.toggleFullscreen,
    speedStep: player.speedStep,
    setSpeed: player.setSpeed,
    setVolume: player.setVolume,
    goBack: player.goBack,
    playNextEpisode: player.playNextEpisode,
    playPrevEpisode: player.playPrevEpisode,
    beginSpeedBoost: player.beginSpeedBoost,
    endSpeedBoost: player.endSpeedBoost,
    showToast: player.showToast,
    videoRef: player.videoRef,
    showSpeedMenu: player.showSpeedMenu,
    showAspectMenu: player.showAspectMenu,
    isSpeedBoost: player.isSpeedBoost,
  })

  const aspectStyle = (() => {
    switch (player.aspectMode) {
      case 1: return { objectFit: 'cover' as const }
      case 2: return { objectFit: 'fill' as const }
      default: return { objectFit: 'contain' as const }
    }
  })()

  const handleDownload = async () => {
    if (!media || !player.isElectron) return
    const url = player.getVideoUrl()
    if (url.startsWith('local-file://')) { player.showToast('已是本地文件'); return }
    try {
      player.showToast('正在加入下载...')
      const key = `${media.id}_${media.pluginName || 'scraper'}`
      await window.electronAPI.downloadEnqueue({
        recordKey: key,
        bangumiId: media.bangumiId || 0,
        pluginName: media.pluginName || 'scraper',
        bangumiName: media.title,
        cover: media.cover || '',
        episodeNumber: 1,
        m3u8Url: url,
        httpHeaders: media.headers || {},
        adBlockerEnabled: true,
      })
      player.showToast('已加入下载队列')
    } catch (e: any) {
      player.showToast('下载失败: ' + e.message)
    }
  }

  if (!media) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <p className="text-[var(--text-muted)]">没有选择媒体</p>
      </div>
    )
  }

  return (
    <div
      ref={player.containerRef}
      className="h-full bg-black relative flex flex-col select-none"
      onMouseMove={player.handleMouseMove}
      onMouseLeave={() => player.playing && player.setShowControls(false)}
    >
      {/* 顶部栏 */}
      <div className={`absolute top-0 left-0 right-0 z-20 transition-all duration-300 ${player.showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="h-12 flex items-center px-4 bg-gradient-to-b from-black/80 to-transparent">
          <button onClick={player.goBack} className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>arrow_back</span>
          </button>
          <span className="ml-3 text-sm text-white/80 truncate">{media.title}</span>
        </div>
      </div>

      {/* 视频区域 */}
      <div className="flex-1 flex items-center justify-center" onClick={player.togglePlay}>
        <video
          ref={player.videoRef}
          src={audioChecking ? undefined : player.getVideoUrl()}
          className="max-w-full max-h-full"
          style={aspectStyle}
          muted={false}
          onTimeUpdate={() => player.setCurrentTime(player.videoRef.current?.currentTime || 0)}
          onDurationChange={() => player.setDuration(player.videoRef.current?.duration || 0)}
          onProgress={() => {
            const v = player.videoRef.current
            if (v && v.buffered.length > 0) player.setBuffered(v.buffered.end(v.buffered.length - 1))
          }}
          onPlay={() => { player.setPlaying(true); player.setError(null) }}
          onPause={() => player.setPlaying(false)}
          onEnded={() => player.setPlaying(false)}
          onError={() => {
            const err = player.videoRef.current?.error
            const code = err?.code || 0
            const msg = err?.message || ''
            if (code === 3) player.setError('视频解码失败。HEVC/H.265 视频需要安装 HEVC 视频扩展（可在 Microsoft Store 搜索 "HEVC Video Extensions" 安装）')
            else if (code === 4) player.setError('视频格式不受支持或文件不存在')
            else player.setError('视频加载失败: ' + (msg || '未知错误'))
          }}
          onWaiting={() => player.setIsLoading(true)}
          onCanPlay={() => player.setIsLoading(false)}
        >
          {subtitles.map((sub, idx) => (
            <track key={idx} kind="subtitles" src={sub.blobUrl} srcLang="zh" label={sub.label} default={idx === activeSubIdx} />
          ))}
        </video>

        {/* 暂停图标 */}
        {!player.playing && !player.error && !player.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center animate-scale-in">
              <span className="material-symbols-rounded text-white" style={{ fontSize: '40px' }}>play_arrow</span>
            </div>
          </div>
        )}

        {/* 加载动画 */}
        {(player.isLoading || audioChecking) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-white/80 text-sm">{audioChecking ? '检测音频编码...' : '加载中...'}</span>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {player.error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/50">
            <div className="flex flex-col items-center gap-4 text-center px-8">
              <span className="material-symbols-rounded text-red-400" style={{ fontSize: '48px' }}>error</span>
              <p className="text-white/90 max-w-md">{player.error}</p>
            </div>
          </div>
        )}

        {/* 临时加速指示器 */}
        {player.isSpeedBoost && (
          <div className="absolute top-16 right-4 px-3 py-1.5 bg-primary-600/90 rounded-lg text-white text-sm font-medium animate-fade-in">
            {SPEED_BOOST}x 加速中
          </div>
        )}

        {/* Toast */}
        {player.toast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 rounded-lg text-white text-sm animate-fade-in">
            {player.toast}
          </div>
        )}
      </div>

      {/* 底部控制栏 */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 ${player.showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-8 pb-3 px-4">
          {/* 进度条 */}
          <div ref={player.progressRef} className="group h-1.5 hover:h-2.5 bg-white/10 rounded-full cursor-pointer transition-all mb-3 relative" onClick={player.handleProgressClick}>
            <div className="absolute h-full bg-white/15 rounded-full" style={{ width: `${player.duration ? (player.buffered / player.duration) * 100 : 0}%` }} />
            <div className="absolute h-full bg-primary-500 rounded-full transition-[width] duration-100" style={{ width: `${player.duration ? (player.currentTime / player.duration) * 100 : 0}%` }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-primary-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg shadow-primary-500/30" />
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={player.togglePlay} className="text-white hover:text-primary-400 transition-colors">
                <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>{player.playing ? 'pause' : 'play_arrow'}</span>
              </button>

              <button onClick={player.playPrevEpisode} className="text-white/70 hover:text-white transition-colors" title="上一集 (P)">
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>skip_previous</span>
              </button>

              <button onClick={player.playNextEpisode} className="text-white/70 hover:text-white transition-colors" title="下一集 (N)">
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>skip_next</span>
              </button>

              <div className="flex items-center gap-2" onMouseEnter={() => player.setShowVolumeSlider(true)} onMouseLeave={() => player.setShowVolumeSlider(false)}>
                <button onClick={() => { if (player.videoRef.current) { const v = player.volume > 0 ? 0 : 1; player.videoRef.current.volume = v; player.setVolume(v) } }} className="text-white/70 hover:text-white transition-colors">
                  <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>{player.volume === 0 ? 'volume_off' : player.volume < 0.5 ? 'volume_down' : 'volume_up'}</span>
                </button>
                {player.showVolumeSlider && (
                  <input type="range" min="0" max="1" step="0.01" value={player.volume} onChange={(e) => { const v = parseFloat(e.target.value); if (player.videoRef.current) player.videoRef.current.volume = v; player.setVolume(v) }} className="w-20 h-1 accent-primary-500 cursor-pointer" />
                )}
              </div>

              <span className="text-xs text-white/60 font-mono">{player.formatTime(player.currentTime)} / {player.formatTime(player.duration)}</span>
            </div>

            <div className="flex items-center gap-2">
              {subtitles.length > 0 && (
                <button onClick={() => { const next = activeSubIdx >= 0 ? -1 : 0; setActiveSubIdx(next); const video = player.videoRef.current; if (video) { for (let i = 0; i < video.textTracks.length; i++) video.textTracks[i].mode = i === next ? 'showing' : 'hidden' } }} className={`transition-colors ${activeSubIdx >= 0 ? 'text-primary-400' : 'text-white/70 hover:text-white'}`}>
                  <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>{activeSubIdx >= 0 ? 'subtitles' : 'closed_caption_disabled'}</span>
                </button>
              )}

              <div className="relative">
                <button onClick={() => { player.setShowSpeedMenu(!player.showSpeedMenu); player.setShowAspectMenu(false) }} className="text-white/70 hover:text-white transition-colors text-xs font-mono px-1.5 py-0.5 rounded" title="倍速 (X/Z)">
                  {player.playbackRate}x
                </button>
                {player.showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden min-w-[80px] animate-fade-in">
                    {SPEED_LIST.map(speed => (
                      <button key={speed} onClick={() => { player.setSpeed(speed); player.setShowSpeedMenu(false) }} className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${player.playbackRate === speed ? 'bg-primary-600 text-white' : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}>
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button onClick={() => { player.setShowAspectMenu(!player.showAspectMenu); player.setShowSpeedMenu(false) }} className="text-white/70 hover:text-white transition-colors" title="画面比例">
                  <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>aspect_ratio</span>
                </button>
                {player.showAspectMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden min-w-[100px] animate-fade-in">
                    {['自动', '裁切填充', '拉伸填充'].map((label, i) => (
                      <button key={i} onClick={() => { player.setAspectMode(i); player.setShowAspectMenu(false) }} className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${player.aspectMode === i ? 'bg-primary-600 text-white' : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {media.source !== 'local' && player.isElectron && (
                <button onClick={handleDownload} className="text-white/70 hover:text-white transition-colors" title="下载">
                  <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>download</span>
                </button>
              )}

              <div className="relative">
                <button
                  onClick={() => { setShowAnime4kMenu(!showAnime4kMenu); player.setShowSpeedMenu(false); player.setShowAspectMenu(false) }}
                  onDoubleClick={(e) => { e.stopPropagation(); toggleAnime4k() }}
                  className={`transition-colors text-xs font-mono px-1.5 py-0.5 rounded ${anime4kEnabled ? 'text-primary-400 bg-primary-600/20' : 'text-white/70 hover:text-white'}`}
                  title="Anime4K 超分辨率 (双击开关)"
                >
                  A4K
                </button>
                {showAnime4kMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden min-w-[120px] animate-fade-in">
                    <button
                      onClick={toggleAnime4k}
                      className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${anime4kEnabled ? 'bg-primary-600 text-white' : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                    >
                      {anime4kEnabled ? '关闭' : '开启'}
                    </button>
                    <div className="border-t border-[var(--border)]" />
                    {([
                      ['upscale', '超分辨率'],
                      ['sharpen', '锐化'],
                      ['upscale+sharpen', '超分+锐化'],
                    ] as [Anime4KMode, string][]).map(([mode, label]) => (
                      <button
                        key={mode}
                        onClick={() => setAnime4kModeAndSync(mode)}
                        className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${anime4kMode === mode ? 'text-primary-400' : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {media.episodes && media.episodes.length > 0 && (
                <button onClick={() => player.setShowEpisodePanel(!player.showEpisodePanel)} className={`transition-colors ${player.showEpisodePanel ? 'text-primary-400' : 'text-white/70 hover:text-white'}`} title="剧集列表">
                  <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>playlist_play</span>
                </button>
              )}

              <button onClick={player.toggleFullscreen} className="text-white/70 hover:text-white transition-colors">
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>{player.isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 剧集面板（右侧滑出） */}
      {player.showEpisodePanel && media.episodes && media.episodes.length > 0 && (
        <div className="absolute top-0 right-0 bottom-0 w-72 bg-[var(--bg-primary)]/95 backdrop-blur-md border-l border-[var(--border)] z-30 animate-slide-in-right overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <span className="text-sm font-medium text-[var(--text-primary)]">剧集 ({media.episodes.length})</span>
            <button onClick={() => player.setShowEpisodePanel(false)} className="text-[var(--text-muted)] hover:text-white">
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-4 gap-2">
              {media.episodes.map((ep, i) => {
                const isActive = ep.url === media.id
                return (
                  <button
                    key={i}
                    onClick={() => player.playEpisode(ep)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-all truncate ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-primary-500/50 hover:text-primary-400'
                    }`}
                  >
                    {ep.name}
                  </button>
                )
              })}
            </div>
          </div>
          {media.source !== 'local' && player.isElectron && (
            <div className="p-3 border-t border-[var(--border)]">
              <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-medium transition-all">
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>download</span>
                下载当前视频
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
