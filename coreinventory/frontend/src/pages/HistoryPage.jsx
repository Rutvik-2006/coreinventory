import { useState, useEffect, useCallback } from 'react';
import { movesApi } from '../utils/api';
import { useToast } from '../hooks/useToast';

const STATUS_BADGE = { draft:'badge-draft', waiting:'badge-waiting', ready:'badge-ready', done:'badge-done', cancelled:'badge-cancelled' };
const TYPE_BADGE   = { receipt:'badge-receipt', delivery:'badge-delivery', internal:'badge-internal', adjustment:'badge-adjustment' };
const DIRECTION_LABEL = { in: '↓ IN', out: '↑ OUT', internal: '⇄ MOVE' };
const DIRECTION_COLOR = { in: 'var(--green)', out: 'var(--red)', internal: 'var(--blue)' };

export default function HistoryPage() {
  const [moves, setMoves]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 50 });
  const [filters, setFilters] = useState({ type: '', status: '', search: '' });
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await movesApi.list({ ...filters, page: pagination.page, limit: pagination.limit });
      setMoves(res.data);
      setPagination(p => ({ ...p, total: res.pagination.total }));
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [filters, pagination.page]);

  useEffect(() => { load(); }, [load]);
  const setF = (k) => (v) => setFilters(f => ({ ...f, [k]: v }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Move History</h1>
          <p className="page-subtitle">{pagination.total} total stock movements</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <SearchIcon />
          <input className="input" placeholder="Search reference or product…"
            value={filters.search}
            onChange={e => setF('search')(e.target.value)} />
        </div>
        <select className="input select" style={{ width: 160 }} value={filters.type} onChange={e => setF('type')(e.target.value)}>
          <option value="">All Types</option>
          <option value="receipt">Receipt</option>
          <option value="delivery">Delivery</option>
          <option value="internal">Internal</option>
          <option value="adjustment">Adjustment</option>
        </select>
        <select className="input select" style={{ width: 160 }} value={filters.status} onChange={e => setF('status')(e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="ready">Ready</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Type</th>
                <th>Direction</th>
                <th>Product</th>
                <th>From</th>
                <th>To</th>
                <th>Qty Planned</th>
                <th>Qty Done</th>
                <th>Status</th>
                <th>Date</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:8}).map((_,i) => (
                  <tr key={i}>{Array.from({length:11}).map((_,j) => (
                    <td key={j}><div className="skeleton" style={{height:14, width:'70%'}} /></td>
                  ))}</tr>
                ))
              ) : moves.length === 0 ? (
                <tr><td colSpan={11}><div className="empty-state"><p>No moves found</p></div></td></tr>
              ) : moves.map(m => (
                <tr key={m.id}>
                  <td><span className="ref-chip">{m.reference}</span></td>
                  <td><span className={`badge ${TYPE_BADGE[m.type]}`}>{m.type}</span></td>
                  <td>
                    <span className="mono text-xs" style={{ color: DIRECTION_COLOR[m.direction] }}>
                      {DIRECTION_LABEL[m.direction]}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{m.product_name}</div>
                    <div className="mono text-xs text-muted">{m.sku}</div>
                  </td>
                  <td className="text-sm text-muted">{m.from_location_name ? `${m.from_warehouse} / ${m.from_location_name}` : '—'}</td>
                  <td className="text-sm text-muted">{m.to_location_name   ? `${m.to_warehouse} / ${m.to_location_name}`   : '—'}</td>
                  <td className="mono text-sm">{Number(m.qty_planned).toLocaleString()} {m.unit_of_measure}</td>
                  <td className="mono text-sm">{m.status === 'done' ? Number(m.qty_done).toLocaleString() : '—'}</td>
                  <td><span className={`badge ${STATUS_BADGE[m.status]}`}>{m.status}</span></td>
                  <td className="text-sm text-muted">{new Date(m.created_at).toLocaleDateString()}</td>
                  <td className="text-sm text-muted">{m.created_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total > pagination.limit && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-sm text-muted">Showing {Math.min((pagination.page-1)*pagination.limit+1, pagination.total)}–{Math.min(pagination.page*pagination.limit, pagination.total)} of {pagination.total}</span>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => setPagination(p => ({...p, page: p.page-1}))} disabled={pagination.page === 1}>← Prev</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setPagination(p => ({...p, page: p.page+1}))} disabled={pagination.page * pagination.limit >= pagination.total}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);
