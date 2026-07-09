import { useRef, useState } from 'react'
import client from '../api/client'

export default function Backup() {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef(null)

  const handleExport = async () => {
    setExporting(true)
    setExportError('')
    try {
      const { data, headers } = await client.get('/books/export', { responseType: 'blob' })
      const disposition = headers['content-disposition'] || ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const filename = match?.[1] || 'bibliotrack-export.zip'
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setExportError(e.response?.data?.detail || "Errore durante l'esportazione")
    } finally {
      setExporting(false)
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportError('')
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await client.post('/books/import', formData)
      setImportResult(data)
    } catch (e) {
      setImportError(e.response?.data?.detail || "Errore durante l'importazione")
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="card p-5">
        <h2 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
          Esporta libreria
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Scarica un archivio ZIP con i tuoi libri, prestiti e copertine — utile come backup o per
          importare la libreria altrove (es. versione mobile).
        </p>
        <button className="btn-primary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Preparazione…' : '⬇️ Scarica backup (.zip)'}
        </button>
        {exportError && (
          <p className="text-sm mt-2" style={{ color: 'var(--danger)' }}>{exportError}</p>
        )}
      </div>

      <div className="card p-5">
        <h2 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
          Importa libreria
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Carica un archivio ZIP esportato da BiblioTrack. I libri già presenti (stesso ISBN, oppure
          stesso titolo e autore) vengono saltati automaticamente — nessuna sovrascrittura.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          onChange={handleFileChange}
          disabled={importing}
          className="text-sm"
          style={{ color: 'var(--text-secondary)' }}
        />
        {importing && (
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Importazione in corso…</p>
        )}
        {importError && (
          <p className="text-sm mt-2" style={{ color: 'var(--danger)' }}>{importError}</p>
        )}
        {importResult && (
          <div className="text-sm mt-3 space-y-1">
            <p style={{ color: 'var(--success)' }}>✓ {importResult.imported} libri importati</p>
            {importResult.skipped > 0 && (
              <p style={{ color: 'var(--text-muted)' }}>
                {importResult.skipped} libri saltati (già presenti)
              </p>
            )}
            {importResult.errors?.length > 0 && (
              <ul className="mt-1 space-y-0.5" style={{ color: 'var(--warning)' }}>
                {importResult.errors.map((err, i) => (
                  <li key={i}>⚠️ {err}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
