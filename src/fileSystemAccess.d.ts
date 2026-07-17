/**
 * File System Access API のうち、TypeScript標準のDOM型に含まれていない部分
 * （showSaveFilePicker・ハンドルの権限確認）だけをここで宣言する
 * （speechRecognition.d.ts と同じ方針。2026-07-17バックアップ改修 修正2+3）。
 * FileSystemHandle/FileSystemFileHandle自体は標準DOM型に既にある。
 */
export {}

declare global {
  interface SaveFilePickerAcceptType {
    description?: string
    accept: Record<string, string | string[]>
  }

  interface SaveFilePickerOptions {
    suggestedName?: string
    types?: SaveFilePickerAcceptType[]
    excludeAcceptAllOption?: boolean
  }

  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite'
  }

  interface FileSystemHandle {
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  }

  interface Window {
    showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>
  }
}
