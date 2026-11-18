import { useMemo, useState } from 'react'
import { ImagePlus, LoaderCircle, Sparkles } from 'lucide-react'
import { useI18n } from '../../hooks/useAppStore'
import type { Collection, DocumentMeta, Series } from '../../types'
import { placeholderCover, fileToCoverData } from '../../utils/cover'
import { formatLabel } from '../../utils/format'
import { Modal } from '../common/Modal'
import { Cover } from '../common/Cover'

export interface GroupFormValues {
  name: string
  description: string
  coverMode: 'auto' | 'custom' | 'document'
  coverDocumentId?: string
  coverData?: string
}

interface GroupFormModalProps {
  kind: 'collection' | 'series'
  initial?: Collection | Series
  documents: DocumentMeta[]
  covers: Record<string, string>
  onSave: (values: GroupFormValues) => void
  onClose: () => void
}

export function GroupFormModal({
  kind,
  initial,
  documents,
  covers,
  onSave,
  onClose,
}: GroupFormModalProps) {
  const { t } = useI18n()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [coverMode, setCoverMode] = useState<'auto' | 'custom' | 'document'>(
    initial?.coverMode ?? 'auto',
  )
  const [coverDocumentId, setCoverDocumentId] = useState(initial?.coverDocumentId ?? '')
  const [coverData, setCoverData] = useState(initial?.coverData ?? '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const firstCoverDoc = documents.find((doc) => covers[doc.id]) ?? documents[0]
  const selectedCoverDoc = documents.find((doc) => doc.id === coverDocumentId) ?? firstCoverDoc
  const previewSource =
    coverMode === 'custom'
      ? coverData
      : coverMode === 'document'
        ? covers[selectedCoverDoc?.id ?? '']
        : covers[firstCoverDoc?.id ?? '']
  const previewFormat = selectedCoverDoc?.format ?? 'image'
  const previewTitle = name || (kind === 'collection' ? t('collections.name') : t('series.name'))
  const fallbackCover = useMemo(
    () => placeholderCover(previewTitle, previewFormat),
    [previewFormat, previewTitle],
  )

  const handleUpload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const data = await fileToCoverData(file)
      if (data) {
        setCoverData(data)
        setCoverMode('custom')
      } else {
        setUploadError('Please choose a JPG, PNG, or WebP image.')
      }
    } catch {
      setUploadError('The image could not be read.')
    } finally {
      setUploading(false)
    }
  }

  const title = initial
    ? kind === 'collection'
      ? t('collections.edit')
      : t('series.edit')
    : kind === 'collection'
      ? t('collections.create')
      : t('series.create')

  return (
    <Modal
      title={title}
      onClose={onClose}
      closeLabel={t('common.close')}
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!name.trim()}
            onClick={() =>
              onSave({
                name: name.trim(),
                description: description.trim(),
                coverMode,
                coverDocumentId: coverMode === 'document' ? coverDocumentId : undefined,
                coverData: coverMode === 'custom' ? coverData || undefined : undefined,
              })
            }
          >
            {initial ? t('common.save') : t('common.create')}
          </button>
        </>
      }
    >
      <div className="group-form">
        <div className="group-form-preview">
          <Cover
            src={previewSource || fallbackCover}
            title={previewTitle}
            format={previewFormat}
            showFormat={false}
            className="group-preview-cover"
          />
          <div className={`label-chip ${coverMode}`}>
            {coverMode === 'custom' ? t('group.uploadImage') : coverMode === 'document' ? t('group.useDocument') : t('group.autoCover')}
          </div>
        </div>
        <div className="group-form-fields">
          <label className="field">
            <span>{kind === 'collection' ? t('collections.name') : t('series.name')}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={
                kind === 'collection' ? t('collections.namePlaceholder') : t('series.namePlaceholder')
              }
              autoFocus
              maxLength={120}
            />
          </label>
          <label className="field">
            <span>{kind === 'collection' ? t('collections.description') : t('series.description')}</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={
                kind === 'collection'
                  ? t('collections.descriptionPlaceholder')
                  : t('series.descriptionPlaceholder')
              }
              rows={3}
              maxLength={500}
            />
          </label>
          <div className="field">
            <span>{t('group.coverSource')}</span>
            <div className="cover-source-options">
              <button
                type="button"
                className={`cover-source-option ${coverMode === 'auto' ? 'active' : ''}`}
                onClick={() => setCoverMode('auto')}
              >
                <Sparkles size={15} />
                {t('group.autoCover')}
              </button>
              <button
                type="button"
                className={`cover-source-option ${coverMode === 'document' ? 'active' : ''}`}
                onClick={() => setCoverMode('document')}
              >
                {t('group.useDocument')}
              </button>
              <label className={`cover-source-option ${coverMode === 'custom' ? 'active' : ''}`}>
                {uploading ? <LoaderCircle size={15} className="spin" /> : <ImagePlus size={15} />}
                <span>{t('group.uploadImage')}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(event) => handleUpload(event.target.files?.[0])}
                />
              </label>
            </div>
            {coverMode === 'document' && documents.length > 0 && (
              <select
                value={coverDocumentId || firstCoverDoc?.id || ''}
                onChange={(event) => setCoverDocumentId(event.target.value)}
              >
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} · {formatLabel(doc.format, doc.extension)}
                  </option>
                ))}
              </select>
            )}
            {coverMode === 'custom' && coverData && (
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() => {
                  setCoverData('')
                  setCoverMode('auto')
                }}
              >
                {t('collections.autoCover')}
              </button>
            )}
            {uploadError && <p className="field-error">{uploadError}</p>}
          </div>
        </div>
      </div>
    </Modal>
  )
}
