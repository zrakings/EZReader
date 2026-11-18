/// <reference types="vite/client" />

interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string | string[]>
}

interface FilePickerOptions {
  types?: FilePickerAcceptType[]
  excludeAcceptAllOption?: boolean
  multiple?: boolean
  id?: string
}

interface OpenFilePickerOptions extends FilePickerOptions {
  multiple?: boolean
}

interface Window {
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (options?: {
    suggestedName?: string
    types?: FilePickerAcceptType[]
  }) => Promise<FileSystemFileHandle>
}
