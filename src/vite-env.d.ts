/// <reference types="vite/client" />

export {}

// 声明 window.electronAPI 的类型
interface ElectronAPI {
  selectFolder: () => Promise<string | null>
  readDirectory: (dirPath: string) => Promise<FileEntry[]>
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
  saveFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  readOrderConfig: (workspacePath: string) => Promise<Record<string, string[]>>
  saveOrderConfig: (workspacePath: string, orderData: Record<string, string[]>) => Promise<{ success: boolean; error?: string }>
  getAppConfig: () => Promise<Record<string, string>>
  setAppConfig: (config: Record<string, string>) => Promise<{ success: boolean; error?: string }>
  createFile: (dirPath: string, fileName: string) => Promise<{ success: boolean; path?: string; error?: string }>
  createFolder: (dirPath: string, folderName: string) => Promise<{ success: boolean; path?: string; error?: string }>
  deleteEntry: (targetPath: string) => Promise<{ success: boolean; error?: string }>
  renameEntry: (oldPath: string, newName: string) => Promise<{ success: boolean; path?: string; error?: string }>
}

interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
