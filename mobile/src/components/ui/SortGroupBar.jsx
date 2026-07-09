import { SORT_OPTIONS, GROUP_OPTIONS } from '../../lib/bookUtils'

export default function SortGroupBar({
  sortBy, sortOrder, groupBy, view,
  onSortBy, onSortOrder, onGroupBy, onView,
  total, filtered,
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center justify-between">
      <div className="flex flex-wrap gap-2 items-center">
        {/* Sort */}
        <select
          className="input-base"
          style={{ width: 'auto', minWidth: '150px', fontSize: '0.875rem' }}
          value={sortBy}
          onChange={(e) => onSortBy(e.target.value)}
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <button
          className="btn-secondary text-sm px-2.5 py-1.5"
          onClick={() => onSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          title={sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
        >
          {sortOrder === 'asc' ? '↑ A–Z' : '↓ Z–A'}
        </button>

        {/* Group */}
        <select
          className="input-base"
          style={{ width: 'auto', minWidth: '160px', fontSize: '0.875rem' }}
          value={groupBy}
          onChange={(e) => onGroupBy(e.target.value)}
        >
          {GROUP_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {value ? `Raggruppa: ${label}` : 'Nessun raggruppamento'}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {filtered !== total ? `${filtered} / ${total}` : total} libr{total === 1 ? 'o' : 'i'}
        </span>

        {/* View toggle */}
        <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {[{ v: 'grid', icon: '⊞', label: 'Griglia' }, { v: 'list', icon: '≡', label: 'Lista' }].map(({ v, icon, label }) => (
            <button
              key={v}
              onClick={() => onView(v)}
              title={label}
              className="px-2.5 py-1 text-sm transition-colors"
              style={{
                backgroundColor: view === v ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: view === v ? 'var(--bg-primary)' : 'var(--text-muted)',
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
