import type { DocumentMeta, FileEntry } from '../../types'
import { ACCEPT_STRING, extensionOf, isAbortError } from '../../utils/format'

const ALL_TYPES: FilePickerAcceptType[] = [
  {
    description: 'EZReader documents',
    accept: {
      'application/pdf': ['.pdf'],
      'application/epub+zip': ['.epub'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/rtf': ['.rtf'],
      'text/plain': ['.txt'],
      'application/vnd.comicbook+zip': ['.cbz'],
      'application/vnd.comicbook-rar': ['.cbr'],
      'application/x-7z-compressed': ['.cb7'],
      'application/x-tar': ['.cbt'],
      'application/zip': ['.zip'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
  },
]

function typesForExtension(extension: string): FilePickerAcceptType[] {
  const ext = extension ? `.${extension.toLowerCase()}` : ''
  if (!ext) return ALL_TYPES
  const mime =
    ext === '.pdf'
      ? 'application/pdf'
      : ext === '.epub'
        ? 'application/epub+zip'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.png'
            ? 'image/png'
            : ext === '.webp'
              ? 'image/webp'
              : ext === '.zip' || ext === '.cbz'
                ? 'application/zip'
                : 'application/octet-stream'
  return [{ description: `EZReader ${ext.toUpperCase()} file`, accept: { [mime]: [ext] } }]
}

function filesFromInput(accept: string, multiple: boolean): Promise<FileEntry[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    input.style.opacity = '0'
    document.body.appendChild(input)
    let settled = false
    const finish = (entries: FileEntry[]) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(entries)
    }
    input.addEventListener(
      'change',
      () => {
        const entries = Array.from(input.files ?? []).map((file) => ({ file }))
        finish(entries)
      },
      { once: true },
    )
    input.addEventListener('cancel', () => finish([]), { once: true })
    // Some browsers never fire cancel; wait for the window to regain focus.
    const onFocus = () => {
      window.setTimeout(() => {
        if (!input.files?.length) finish([])
      }, 600)
    }
    window.addEventListener('focus', onFocus, { once: true })
    input.click()
  })
}

export async function pickFiles(options?: {
  multiple?: boolean
  accept?: string
  extension?: string
  preferSystemPicker?: boolean
}): Promise<FileEntry[]> {
  const multiple = options?.multiple ?? true
  const accept = options?.accept ?? ACCEPT_STRING
  const preferSystemPicker = options?.preferSystemPicker ?? true

  if (preferSystemPicker && typeof window.showOpenFilePicker === 'function') {
    try {
      const handles = await window.showOpenFilePicker({
        multiple,
        types: options?.extension ? typesForExtension(options.extension) : ALL_TYPES,
        excludeAcceptAllOption: false,
        id: 'ezreader-files',
      })
      const entries = await Promise.all(
        handles.map(async (handle) => ({ file: await handle.getFile(), handle })),
      )
      return entries
    } catch (error) {
      if (isAbortError(error)) return []
      // Permission denied or an unsupported picker context: use a regular input.
      console.warn('EZReader system file picker unavailable, using file input.', error)
    }
  }

  return filesFromInput(options?.extension ? `.${options.extension}` : accept, multiple)
}

export function pickSingleFile(extension?: string): Promise<FileEntry | null> {
  return pickFiles({ multiple: false, extension }).then((entries) => entries[0] ?? null)
}

export function matchFileToDocument(
  file: File,
  document: DocumentMeta,
): {
  nameMatch: boolean
  sizeMatch: boolean
  extensionMatch: boolean
  exact: boolean
  score: number
} {
  const nameMatch = file.name.toLowerCase() === document.fileName.toLowerCase()
  const sizeMatch = file.size === document.size
  const extensionMatch =
    !document.extension || extensionOf(file.name) === document.extension.toLowerCase()
  const score = Number(nameMatch) * 2 + Number(sizeMatch) * 2 + Number(extensionMatch)
  return {
    nameMatch,
    sizeMatch,
    extensionMatch,
    exact: nameMatch && sizeMatch && extensionMatch,
    score,
  }
}
