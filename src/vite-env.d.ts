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

  // 剪贴板图片保存
  saveClipboardImage: (workspacePath: string, base64Data: string) => Promise<{ success: boolean; path?: string; error?: string }>

  // 标签系统
  tagsScanWorkspace: (workspacePath: string) => Promise<{ success: boolean; data?: any; error?: string }>
  tagsReadIndex: (workspacePath: string) => Promise<{ success: boolean; data?: any; error?: string }>
  tagsPatchFile: (workspacePath: string, relativePath: string, content: string) => Promise<{ success: boolean; data?: any; error?: string }>
  tagsRemoveFile: (workspacePath: string, relativePath: string) => Promise<{ success: boolean; data?: any; error?: string }>
  tagsReadSchema: (workspacePath: string) => Promise<{ success: boolean; data?: any; error?: string }>
  tagsSaveSchema: (workspacePath: string, schema: any) => Promise<{ success: boolean; error?: string }>
  tagsReadTreeTxt: (workspacePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
  tagsSaveTreeTxt: (workspacePath: string, text: string) => Promise<{ success: boolean; data?: any; error?: string }>
  tagsStopWatch: (workspacePath: string) => Promise<{ success: boolean }>

  // 文件变更监听
  onFileChanged: (callback: (info: { relativePath: string; eventType: string }) => void) => () => void
  onTagsConfigChanged: (callback: (info: { file: string }) => void) => () => void

  // 窗口控制
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
