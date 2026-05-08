import { useState, useEffect } from 'react'

const NOTICE_KEY = 'anime-player-notice-v1'

export default function NoticeDialog() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(NOTICE_KEY)
    if (!seen) {
      // 延迟一点弹出，让页面先加载完
      const timer = setTimeout(() => setIsOpen(true), 500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAgree = () => {
    localStorage.setItem(NOTICE_KEY, String(Date.now()))
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-[var(--bg-secondary)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                使用须知
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Anime Player V2
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center">
              <span className="material-symbols-rounded text-primary-400" style={{ fontSize: '28px' }}>
                info
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-5">
          {/* 欢迎使用 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
                <span className="material-symbols-rounded text-green-400" style={{ fontSize: '16px' }}>celebration</span>
              </span>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">欢迎使用</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed pl-9">
              本软件完全免费开源，无需注册、无需付费、无内购，即可使用全部功能。我们致力于为动漫爱好者提供便捷的观看体验，祝您观影愉快！
            </p>
          </div>

          {/* 版权声明 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <span className="material-symbols-rounded text-blue-400" style={{ fontSize: '16px' }}>copyright</span>
              </span>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">版权声明</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed pl-9">
              本软件不存储、不上传、不分发、不缓存任何视频内容。所有视频均来自互联网第三方公开资源，本软件仅提供索引和播放功能。视频版权归原作者及版权方所有，如有侵权请联系我们删除，我们将在 24 小时内处理。严禁将本软件用于任何商业用途、二次分发、合成或盈利活动。严禁将本软件用于任何形式的公开传播、公开展示或公开放映。
            </p>
          </div>

          {/* 免责声明 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg bg-yellow-500/15 flex items-center justify-center">
                <span className="material-symbols-rounded text-yellow-400" style={{ fontSize: '16px' }}>warning</span>
              </span>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">免责声明</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed pl-9">
              使用本软件所产生的一切后果由用户自行承担，开发者不承担任何责任。包括但不限于：因使用本软件导致的任何直接、间接、偶然、特殊或后果性的损害，包括但不限于数据丢失、设备损坏、网络中断等。未经授权的破解、修改、反编译、二次打包行为所产生的任何后果，均与原作者无关。本软件按「现状」提供，不作任何明示或暗示的保证，包括但不限于适销性、特定用途适用性、不侵权等。
            </p>
          </div>

          {/* 法律合规 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
                <span className="material-symbols-rounded text-purple-400" style={{ fontSize: '16px' }}>gavel</span>
              </span>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">法律合规</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed pl-9">
              用户应遵守所在国家/地区的法律法规，包括但不限于著作权法、计算机信息网络安全保护管理办法等。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end">
          <button
            onClick={handleAgree}
            className="px-8 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-medium transition-all active:scale-95"
          >
            我已阅读并同意
          </button>
        </div>
      </div>
    </div>
  )
}
