# CLAUDE.md

## 项目概述

"UV Note" — 一款基于 React 的 Windows 桌面端笔记软件，类似 Obsidian。

## 核心规则（必须严格遵守）

### 用户技术水平

用户是编程/技术小白，对技术细节不熟悉。因此在整个项目开发过程中：

1. **任何技术决策都不得自行决定。** 必须列出多个可选方案，用通俗语言向用户解释每个方案的优缺点，由用户来选择。
2. **解释技术概念时使用类比和简单语言**，避免专业术语堆砌。
3. **每个方案说明应包含：**
   - 这个方案是什么（用日常事物类比）
   - 优点（对用户有什么好处）
   - 缺点（有什么代价或风险）
   - 我的推荐（可以给出倾向性建议，但最终决定权在用户）
4. **代码实现前先确认方案**，避免写了代码用户不满意要返工。
5. **涉及 UI/交互的决策也要给选项**，比如布局方式、颜色方案、交互手势等。

### 开发流程

1. 功能讨论 → 列出技术方案 → 用户选择 → 编写代码 → 用户反馈
2. 每次改动尽量小步快跑，便于用户理解和反馈。
3. 优先保证核心功能可用，再逐步迭代。

## 技术背景（已确认）

- 桌面框架：**Electron 28**（2026-07-28 确认）
- UI 框架：**React 18 + TypeScript**
- 构建工具：**Vite 5**（2026-07-28 确认）
- 数据存储：**JSON 配置文件**，存放在 `.uvnote/` 目录下（2026-07-28 确认）
- 配置目录名：`.uvnote`（无连字符）
- 包管理：**npm**
- 目标平台：Windows 10/11
- **重要：Electron 主进程使用 ESM 模块**（`.mjs`），通过 `import ... from 'electron/main'` 导入 API，而非传统的 `require('electron')`。这是根据 Electron 自带的 default_app 源码确认的正确写法。

## 项目结构

```
UV Note/
├── CLAUDE.md              ← 项目规则（本文件）
├── docs/                  ← 文档目录
│   ├── 产品文档.md
│   └── 切实需求/
│       ├── 13
│       └── 14
├── electron/              ← Electron 主进程
│   ├── main.js            ← 窗口管理 + IPC 接口
│   └── preload.js         ← 安全桥梁（暴露 API 给 React）
├── src/                   ← React 渲染进程
│   ├── main.tsx           ← React 入口
│   ├── App.tsx            ← 主界面组件
│   ├── App.css            ← 全局样式（Obsidian 暗色主题）
│   └── vite-env.d.ts      ← TypeScript 类型声明
├── index.html             ← HTML 入口
├── package.json           ← 依赖与脚本
├── vite.config.ts         ← Vite 配置
├── tsconfig.json          ← TypeScript 配置
└── .gitignore
```

## 开发命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动开发模式（Vite + Electron 同时启动） |
| `npm run build` | 编译 React 代码到 `dist/` |
| `npx tsc --noEmit` | TypeScript 类型检查（只查错，不输出文件） |

## 已实现的 IPC 接口（Electron ↔ React）

React 通过 `window.electronAPI` 调用以下功能：
- `selectFolder()` — 打开系统文件夹选择对话框
- `readDirectory(path)` — 读取目录内容
- `readFile(path)` — 读取文本文件
- `readOrderConfig(workspacePath)` — 读取 `.uvnote/order.json`
- `saveOrderConfig(workspacePath, data)` — 保存排序配置

## 参考需求文档

- `docs/切实需求/13` — 提醒/时间管理相关
- `docs/切实需求/14` — 精炼功能/可视化相关
