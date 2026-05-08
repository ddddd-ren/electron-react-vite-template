/**
 * M3U8 Parser - Ported from Kazumi (Dart)
 * Pure algorithm implementation, no external dependencies
 */

class M3u8Parser {
  detectType(content) {
    if (content.includes('#EXT-X-STREAM-INF')) {
      return 'master'
    }
    return 'media'
  }

  resolveUrl(baseUrl, relativeUrl) {
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl
    }
    const baseUri = new URL(baseUrl)
    if (relativeUrl.startsWith('/')) {
      return `${baseUri.protocol}//${baseUri.host}${baseUri.port ? ':' + baseUri.port : ''}${relativeUrl}`
    }
    const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1)
    return `${basePath}${relativeUrl}`
  }

  parseMasterPlaylist(content, baseUrl) {
    const lines = content.split('\n').map(l => l.trim())
    const variants = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        const attrs = line.substring('#EXT-X-STREAM-INF:'.length)
        let bandwidth = 0
        let resolution = null

        const bandwidthMatch = attrs.match(/BANDWIDTH=(\d+)/)
        if (bandwidthMatch) {
          bandwidth = parseInt(bandwidthMatch[1])
        }

        const resolutionMatch = attrs.match(/RESOLUTION=([^\s,]+)/)
        if (resolutionMatch) {
          resolution = resolutionMatch[1]
        }

        if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
          const uri = this.resolveUrl(baseUrl, lines[i + 1])
          variants.push({ bandwidth, resolution, uri })
        }
      }
    }

    return { variants }
  }

  parseMediaPlaylist(content, baseUrl) {
    const lines = content.split('\n').map(l => l.trim())
    const segments = []
    let targetDuration = 0
    let hasEndList = false
    let isExplicitVod = false
    let isLiveEvent = false
    let currentDiscontinuityGroup = 0
    let currentKey = null
    let currentDuration = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith('#EXT-X-TARGETDURATION:')) {
        targetDuration = parseFloat(line.substring('#EXT-X-TARGETDURATION:'.length))
      } else if (line === '#EXT-X-ENDLIST') {
        hasEndList = true
      } else if (line === '#EXT-X-PLAYLIST-TYPE:VOD') {
        isExplicitVod = true
      } else if (line === '#EXT-X-PLAYLIST-TYPE:EVENT') {
        isLiveEvent = true
      } else if (line === '#EXT-X-DISCONTINUITY') {
        currentDiscontinuityGroup++
      } else if (line.startsWith('#EXT-X-KEY:')) {
        currentKey = this._parseKey(line, baseUrl)
      } else if (line.startsWith('#EXTINF:')) {
        const durationStr = line.substring('#EXTINF:'.length).split(',')[0]
        currentDuration = parseFloat(durationStr)
      } else if (line.length > 0 && !line.startsWith('#')) {
        const uri = this.resolveUrl(baseUrl, line)
        segments.push({
          duration: currentDuration,
          uri,
          discontinuityGroup: currentDiscontinuityGroup,
          key: currentKey,
        })
        currentDuration = 0
      }
    }

    const isVod = hasEndList || isExplicitVod || (!isLiveEvent && segments.length > 0)

    return { segments, targetDuration, isVod }
  }

  _parseKey(line, baseUrl) {
    const attrs = line.substring('#EXT-X-KEY:'.length)

    const methodMatch = attrs.match(/METHOD=([^,]+)/)
    const method = methodMatch ? methodMatch[1] : 'NONE'

    if (method === 'NONE') return null

    const uriMatch = attrs.match(/URI="([^"]+)"/)
    const uri = uriMatch ? this.resolveUrl(baseUrl, uriMatch[1]) : ''

    const ivMatch = attrs.match(/IV=(0x[0-9a-fA-F]+)/)
    const iv = ivMatch ? ivMatch[1] : null

    return { method, uri, iv }
  }

  extractUniqueKeys(playlist) {
    const seen = new Set()
    const keys = []
    for (const seg of playlist.segments) {
      if (seg.key && !seen.has(seg.key.uri)) {
        seen.add(seg.key.uri)
        keys.push(seg.key)
      }
    }
    return keys
  }

  buildLocalM3u8(segments, targetDuration, keyUriToLocal = {}) {
    const sb = []
    sb.push('#EXTM3U')
    sb.push('#EXT-X-VERSION:3')
    sb.push(`#EXT-X-TARGETDURATION:${Math.ceil(targetDuration)}`)
    sb.push('#EXT-X-MEDIA-SEQUENCE:0')

    let lastDiscontinuityGroup = 0
    let lastKey = null

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]

      if (seg.discontinuityGroup !== lastDiscontinuityGroup && i > 0) {
        sb.push('#EXT-X-DISCONTINUITY')
        lastDiscontinuityGroup = seg.discontinuityGroup
      }

      if (seg.key !== lastKey) {
        if (seg.key === null) {
          sb.push('#EXT-X-KEY:METHOD=NONE')
        } else {
          const localUri = keyUriToLocal[seg.key.uri] || seg.key.uri
          let keyLine = `#EXT-X-KEY:METHOD=${seg.key.method},URI="${localUri}"`
          if (seg.key.iv) {
            keyLine += `,IV=${seg.key.iv}`
          }
          sb.push(keyLine)
        }
        lastKey = seg.key
      }

      sb.push(`#EXTINF:${seg.duration.toFixed(6)},`)
      sb.push(`seg_${String(i).padStart(5, '0')}.ts`)
    }

    sb.push('#EXT-X-ENDLIST')
    return sb.join('\n')
  }

  _isM3u8Url(url) {
    try {
      const path = new URL(url).pathname.toLowerCase()
      return path.endsWith('.m3u8')
    } catch {
      return false
    }
  }

  async resolveNestedSegments(segments, fetcher, maxDepth = 3) {
    if (maxDepth <= 0) return segments
    if (!segments.some(s => this._isM3u8Url(s.uri))) return segments

    const result = []
    let groupOffset = 0

    for (const seg of segments) {
      if (!this._isM3u8Url(seg.uri)) {
        result.push({
          duration: seg.duration,
          uri: seg.uri,
          discontinuityGroup: seg.discontinuityGroup + groupOffset,
          key: seg.key,
        })
        continue
      }

      try {
        const content = await fetcher(seg.uri)
        const nested = this.parseMediaPlaylist(content, seg.uri)
        const resolved = await this.resolveNestedSegments(nested.segments, fetcher, maxDepth - 1)

        if (resolved.length === 0) continue

        const nestedBase = seg.discontinuityGroup + groupOffset
        let maxNestedGroup = 0
        for (const ns of resolved) {
          if (ns.discontinuityGroup > maxNestedGroup) {
            maxNestedGroup = ns.discontinuityGroup
          }
        }

        for (const ns of resolved) {
          result.push({
            duration: ns.duration,
            uri: ns.uri,
            discontinuityGroup: ns.discontinuityGroup + nestedBase,
            key: ns.key,
          })
        }

        groupOffset += maxNestedGroup
      } catch (e) {
        result.push({
          duration: seg.duration,
          uri: seg.uri,
          discontinuityGroup: seg.discontinuityGroup + groupOffset,
          key: seg.key,
        })
      }
    }

    return result
  }
}

/**
 * M3U8 Ad Filter - Ported from Kazumi (Dart)
 */
class M3u8AdFilter {
  filterAds(segments) {
    if (segments.length === 0) return segments

    // Group by discontinuityGroup
    const groups = new Map()
    for (const seg of segments) {
      if (!groups.has(seg.discontinuityGroup)) {
        groups.set(seg.discontinuityGroup, [])
      }
      groups.get(seg.discontinuityGroup).push(seg)
    }

    // If only one group, no ads
    if (groups.size <= 1) return segments

    // Find the longest group as main content reference
    let maxDuration = 0
    let mainGroupDuration = 0
    for (const [groupId, groupSegs] of groups) {
      const groupDuration = groupSegs.reduce((sum, s) => sum + s.duration, 0)
      if (groupDuration > maxDuration) {
        maxDuration = groupDuration
        mainGroupDuration = groupDuration
      }
    }

    // Filter out ad groups
    const adGroups = new Set()
    for (const [groupId, groupSegs] of groups) {
      const groupDuration = groupSegs.reduce((sum, s) => sum + s.duration, 0)

      // Shorter than 30% of main content
      if (groupDuration < mainGroupDuration * 0.3) {
        adGroups.add(groupId)
        continue
      }

      // First or last group shorter than 30 seconds
      const isFirst = groupId === Math.min(...groups.keys())
      const isLast = groupId === Math.max(...groups.keys())
      if ((isFirst || isLast) && groupDuration < 30) {
        adGroups.add(groupId)
        continue
      }

      // Any group shorter than 10 seconds
      if (groupDuration < 10) {
        adGroups.add(groupId)
      }
    }

    // Remove ad segments
    return segments.filter(s => !adGroups.has(s.discontinuityGroup))
  }

  calculateTargetDuration(segments) {
    if (segments.length === 0) return 0
    const maxDuration = Math.max(...segments.map(s => s.duration))
    return Math.ceil(maxDuration)
  }
}

module.exports = {
  m3u8Parser: new M3u8Parser(),
  m3u8AdFilter: new M3u8AdFilter(),
}
