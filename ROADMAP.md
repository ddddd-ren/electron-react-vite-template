# anime-player-v2 开发路线图

## 对标项目
Kazumi（Flutter，GitHub 10k+ stars）— 功能最全的开源动漫播放器

## 核心原则
**能抄就抄，不要从零造轮子。** 参考现有开源实现，集成成熟方案，不要重复造轮子。

---

## 技术决策

### 播放器内核方案
- **❌ mpv.js（已废弃）**：使用 Pepper Plugin API (PPAPI)，Chrome 2020 年已移除支持，不兼容 Electron 28（Chromium 120+）
- **✅ Electron 原生硬件加速（第一阶段）**：改动最小，风险最低，Chromium 120+ 本身支持硬件解码（MediaSource Extensions + WebCodecs）
- **⚠️ mpv 子进程方案（备选）**：如果原生方案格式支持不够再考虑。方案：mpv 子进程 + JSON IPC + 窗口嵌入（--wid），需要附带 mpv.exe（~30MB），处理 Z-order 和跨平台兼容性

---

## 模块规划

### 1. 播放器内核升级（P0）
- **现状**：原生 `<video>` 标签
- **目标**：Electron 原生硬件加速，支持硬件解码、多音轨、多字幕
- **参考项目**：
  - `Predidit/Kazumi` — https://github.com/Predidit/Kazumi — media_kit 集成方式，参考架构思路（Flutter 端，Electron 无法直接用）
  - Electron 官方文档 — MediaSource Extensions + WebCodecs 硬件解码
- **ClawX**：配置 Electron 硬件解码，优化播放性能
- **Trae**：PlayerPage 控制栏 UI 适配新内核

### 2. 超分辨率（P1）
- **现状**：无
- **目标**：Anime4K shader 实时超分
- **参考项目**：
  - `bloc97/Anime4K` — https://github.com/bloc97/Anime4K — 原始 GLSL shader 文件，直接拿
  - `chenmozhijin/Anime4K-WebExtension` — https://github.com/chenmozhijin/Anime4K-WebExtension — WebGPU/WebGL2 渲染管线实现，直接参考
- **ClawX**：WebGL2 渲染管线 + Anime4K shader 移植
- **Trae**：超分开关 UI、画质选择菜单

### 3. 数据源生态（P1）
- **现状**：TVBox JSON + 苹果CMS API，预置3个源
- **目标**：支持 XPath 规则引擎，用户可导入/编写规则采集任意网站
- **参考项目**：
  - `Predidit/Kazumi` — https://github.com/Predidit/Kazumi — lib/ 下的规则解析逻辑，JSON schema + XPath
  - npm 包 `cheerio` + `xpath` — HTML 解析 + XPath 查询，轻量替代方案
- **ClawX**：XPath 规则引擎核心、规则格式设计
- **Trae**：规则管理 UI（导入/编辑/删除/预览）、数据源卡片

### 4. 追番生态（P2）
- **现状**：无
- **目标**：整合 Bangumi / AniList，支持追番列表、进度同步、新番提醒
- **参考项目**：
  - Bangumi 官方 API — https://api.bgm.tv — REST API，文档完善
  - AniList GraphQL API — https://graphql.anilist.co — GraphQL 查询
  - `MALSync/MALSync` — https://github.com/MALSync/MALSync — TypeScript 实现的多平台追番同步
  - `czy0729/Bangumi` — https://github.com/czy0729/Bangumi — React Native 客户端，参考 API 调用方式
- **Trae**：OAuth 登录、追番列表、进度同步、新番日历
- **ClawX**：底层协助（API 鉴权、token 存储问题）

---

## 执行顺序
播放器内核 → 超分辨率 → 数据源生态 → 追番生态

## 分工
- **ClawX**（mimov2 5pro）：播放器内核、超分辨率、规则引擎核心、底层问题协助
- **Trae**（字节豆包）：UI 适配、超分 UI、规则管理 UI、追番生态全部 UI 和业务逻辑
