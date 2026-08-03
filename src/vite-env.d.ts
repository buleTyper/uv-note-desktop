/// <reference types="vite/client" />

export {}

interface ElectronAPI {
  selectFolder: () => Promise<string | null>
  readDirectory: (dirPath: string) => Promise<FileEntry[]>
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
  saveFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  getAppConfig: () => Promise<Record<string, string>>
  setAppConfig: (config: Record<string, string>) => Promise<{ success: boolean; error?: string }>
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
