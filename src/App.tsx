import { useEffect } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import UpdateDialog from './components/UpdateDialog'
import NoticeDialog from './components/NoticeDialog'
import HomePage from './pages/HomePage'
import LibraryPage from './pages/LibraryPage'
import PlayerPage from './pages/PlayerPage'
import SettingsPage from './pages/SettingsPage'
import DownloadPage from './pages/DownloadPage'
import SourcePage from './pages/SourcePage'
import { useStore } from './store/useStore'

export default function App() {
  const { currentPage, currentMedia, _loadRecent, _loadFolders } = useStore()

  // 启动时加载持久化数据
  useEffect(() => {
    _loadRecent()
    _loadFolders()
  }, [])

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <HomePage />
      case 'library': return <LibraryPage />
      case 'player': return <PlayerPage media={currentMedia} />
      case 'settings': return <SettingsPage />
      case 'download': return <DownloadPage />
      case 'source': return <SourcePage />
      default: return <HomePage />
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* 标题栏 */}
      <TitleBar />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 - 播放器页面隐藏 */}
        {currentPage !== 'player' && <Sidebar />}

        {/* 主内容区 */}
        <main className="flex-1 overflow-hidden">
          {renderPage()}
        </main>
      </div>

      {/* 更新日志弹窗 - 版本变化时显示 */}
      <UpdateDialog />

      {/* 首次启动使用须知弹窗 */}
      <NoticeDialog />
    </div>
  )
}
