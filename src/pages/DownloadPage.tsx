import { useEffect } from 'react'
import { useDownloadStore } from '../store/useDownloadStore'
import { useStore } from '../store/useStore'
import { DownloadStatus, DownloadRecord } from '../types/download'
import { formatBytes, formatSpeed } from '../utils'

const statusLabels: Record<DownloadStatus, string> = {
  [DownloadStatus.pending]: '等待中',
  [DownloadStatus.downloading]: '下载中',
  [DownloadStatus.paused]: '已暂停',
  [DownloadStatus.completed]: '已完成',
  [DownloadStatus.failed]: '失败',
}

const statusColors: Record<DownloadStatus, string> = {
  [DownloadStatus.pending]: 'text-yellow-400',
  [DownloadStatus.downloading]: 'text-blue-400',
  [DownloadStatus.paused]: 'text-gray-400',
  [DownloadStatus.completed]: 'text-green-400',
  [DownloadStatus.failed]: 'text-red-400',
}

export default function DownloadPage() {
  const { records, activeDownloads, loadRecords, subscribeProgress, pause, resume, cancel, deleteRecord } = useDownloadStore()
  const { playMedia, setPage } = useStore()

  useEffect(() => {
    loadRecords()
    const unsub = subscribeProgress()
    return () => unsub?.()
  }, [])

  const handlePlay = (record: DownloadRecord, episodeNumber: number) => {
    const episode = record.episodes[episodeNumber]
    if (episode?.status === 'completed' && episode?.localM3u8Path) {
      playMedia({
        id: `${record.bangumiId}_${record.pluginName}_${episodeNumber}`,
        title: `${record.bangumiName} - 第${episodeNumber}集`,
        source: 'local',
        path: episode.localM3u8Path,
        cover: record.cover,
      })
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-2xl font-bold mb-6">下载管理</h1>

      {records.length === 0 ? (
        <div className="text-center text-gray-400 mt-20">
          <p className="text-lg">暂无下载任务</p>
          <p className="text-sm mt-2">在播放页面可以添加下载任务</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map(record => (
            <div key={`${record.bangumiId}_${record.pluginName}`} className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {record.cover && (
                    <img src={record.cover} alt="" className="w-12 h-16 object-cover rounded" />
                  )}
                  <div>
                    <h3 className="font-medium">{record.bangumiName}</h3>
                    <p className="text-sm text-gray-400">{record.pluginName}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteRecord(record.bangumiId, record.pluginName)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  删除全部
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(record.episodes).map(([epNum, episode]) => {
                  const num = parseInt(epNum)
                  const key = `${record.bangumiId}_${record.pluginName}_${num}`
                  const task = activeDownloads.get(`${record.bangumiId}_${record.pluginName}_${num}`)

                  return (
                    <div key={epNum} className="bg-[var(--bg-primary)] rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">第{num}集</span>
                        <span className={`text-xs ${statusColors[episode.status] || 'text-gray-400'}`}>
                          {statusLabels[episode.status] || episode.status}
                        </span>
                      </div>

                      {episode.status === DownloadStatus.downloading && (
                        <div className="mb-2">
                          <div className="w-full bg-gray-700 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${(episode.progressPercent * 100).toFixed(1)}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs text-gray-400">
                              {(episode.progressPercent * 100).toFixed(1)}%
                            </span>
                            <span className="text-xs text-gray-400">
                              {task?.speed ? formatSpeed(task.speed) : ''}
                            </span>
                          </div>
                        </div>
                      )}

                      {episode.status === DownloadStatus.completed && (
                        <div className="text-xs text-gray-400 mb-2">
                          {formatBytes(episode.totalBytes)}
                        </div>
                      )}

                      {episode.errorMessage && (
                        <div className="text-xs text-red-400 mb-2 truncate" title={episode.errorMessage}>
                          {episode.errorMessage}
                        </div>
                      )}

                      <div className="flex gap-1">
                        {episode.status === DownloadStatus.downloading && (
                          <button
                            onClick={() => pause(`${record.bangumiId}_${record.pluginName}`, num)}
                            className="text-xs px-2 py-1 bg-yellow-600 rounded hover:bg-yellow-500"
                          >
                            暂停
                          </button>
                        )}
                        {episode.status === DownloadStatus.paused && (
                          <button
                            onClick={() => resume({
                              recordKey: `${record.bangumiId}_${record.pluginName}`,
                              bangumiId: record.bangumiId,
                              pluginName: record.pluginName,
                              bangumiName: record.bangumiName,
                              cover: record.cover,
                              episodeNumber: num,
                              m3u8Url: episode.networkM3u8Url,
                              httpHeaders: {},
                              adBlockerEnabled: false,
                            })}
                            className="text-xs px-2 py-1 bg-blue-600 rounded hover:bg-blue-500"
                          >
                            恢复
                          </button>
                        )}
                        {(episode.status === DownloadStatus.downloading || episode.status === DownloadStatus.paused) && (
                          <button
                            onClick={() => cancel(`${record.bangumiId}_${record.pluginName}`, num)}
                            className="text-xs px-2 py-1 bg-red-600 rounded hover:bg-red-500"
                          >
                            取消
                          </button>
                        )}
                        {episode.status === DownloadStatus.completed && (
                          <button
                            onClick={() => handlePlay(record, num)}
                            className="text-xs px-2 py-1 bg-green-600 rounded hover:bg-green-500"
                          >
                            播放
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
