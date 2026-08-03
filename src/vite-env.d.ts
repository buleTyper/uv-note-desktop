/// <reference types="vite/client" />

export {}

interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

interface ElectronAPI {
  // 文件操作
  selectFolder: () => Promise<string | null>
  readDirectory: (dirPath: string) => Promise<FileEntry[]>
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
  saveFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  getAppConfig: () => Promise<Record<string, string>>
  setAppConfig: (config: Record<string, string>) => Promise<{ success: boolean; error?: string }>

  // 窗口控制（无边框自定义标题栏用）
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  onWindowMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
