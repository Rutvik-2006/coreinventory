import { useState, useEffect, useCallback } from 'react';
import { movesApi, productsApi, warehousesApi } from '../utils/api';
import { useToast } from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';

const STATUS_BADGE = { draft:'badge-draft', waiting:'badge-waiting', ready:'badge-ready', done:'badge-done', cancelled:'badge-cancelled' };
const TYPE_BADGE   = { receipt:'badge-receipt', delivery:'badge-delivery', internal:'badge-internal', adjustment:'badge-adjustment' };

function MoveForm({ type, onClose, onSaved }) {
  const [form, setForm] = useState({ type, product_id: '', from_location: '', to_location: '', qty_planned: '', supplier: '', customer: '', notes: '' });
  const [products,  setProducts]  = useState([]);
  const [locations, setLocations] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    Promise.all([productsApi.list({ limit: 200 }), warehousesApi.allLocations()])
      .then(([p, l]) => { setProducts(p.data); setLocations(l.data); });
  }, []);

  const validate = () => {
    const e = {};
    if (!form.product_id)  e.product_id  = 'Select a product';
    if (!form.qty_planned || Number(form.qty_planned) <= 0) e.qty_planned = 'Quantity must be > 0';
    if (type === 'receipt'  && !form.to_location)   e.to_location   = 'Select destination';
    if (type === 'delivery' && !form.from_location)  e.from_location  = 'Select source location';
    if (type === 'internal' && !form.from_location)  e.from_location  = 'Select source location';
    if (type === 'internal' && !form.to_location)    e.to_location    = 'Select destination';
    return e;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await movesApi.create({
        ...form,
        qty_planned: Number(form.qty_planned),
        from_location: form.from_location || null,
        to_location:   form.to_location   || null,
      });
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} created`);
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const setF = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: '' })); };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ fontWeight: 600 }}>New {type.charAt(0).toUpperCase() + type.slice(1)}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="form-group">
            <label className="label">Product *</label>
            <select className={`input select ${errors.product_id ? 'error' : ''}`} value={form.product_id} onChange={setF('product_id')}>
              <option value="">Select product…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
            {errors.product_id && <span className="error-msg">{errors.product_id}</span>}
          </div>

          <div className="form-group">
            <label className="label">Quantity *</label>
            <input className={`input ${errors.qty_planned ? 'error' : ''}`} type="number" min="0.001" step="any"
              value={form.qty_planned} onChange={setF('qty_planned')} placeholder="0" />
            {errors.qty_planned && <span className="error-msg">{errors.qty_planned}</span>}
          </div>

          {(type === 'delivery' || type === 'internal') && (
            <div className="form-group">
              <label className="label">From Location *</label>
              <select className={`input select ${errors.from_location ? 'error' : ''}`} value={form.from_location} onChange={setF('from_location')}>
                <option value="">Select source…</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.warehouse_name} — {l.name}</option>)}
              </select>
              {errors.from_location && <span className="error-msg">{errors.from_location}</span>}
            </div>
          )}

          {(type === 'receipt' || type === 'internal') && (
            <div className="form-group">
              <label className="label">To Location *</label>
              <select className={`input select ${errors.to_location ? 'error' : ''}`} value={form.to_location} onChange={setF('to_location')}>
                <option value="">Select destination…</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.warehouse_name} — {l.name}</option>)}
              </select>
              {errors.to_location && <span className="error-msg">{errors.to_location}</span>}
            </div>
          )}

          {type === 'receipt' && (
            <div className="form-group">
              <label className="label">Supplier</label>
              <input className="input" value={form.supplier} onChange={setF('supplier')} placeholder="Supplier name" />
            </div>
          )}
          {type === 'delivery' && (
            <div className="form-group">
              <label className="label">Customer</label>
              <input className="input" value={form.customer} onChange={setF('customer')} placeholder="Customer / destination" />
            </div>
          )}
          <div className="form-group">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={setF('notes')} placeholder="Optional notes…" style={{ resize:'vertical' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" /> Saving…</> : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ValidateModal({ move, onClose, onDone }) {
  const [qty, setQty] = useState(move.qty_planned);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleValidate = async () => {
    setSaving(true);
    try {
      await movesApi.validate(move.id, { qty_done: Number(qty) });
      toast.success(`${move.reference} validated — stock updated`);
      onDone();
    } catch (err) { toast.error(err.message); setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 600 }}>Validate Move</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <p className="text-sm text-muted">Validating <strong className="mono">{move.reference}</strong> will update stock levels immediately.</p>
          <div className="form-group">
            <label className="label">Quantity Done</label>
            <input className="input" type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)} />
            <span className="helper-msg">Planned: {move.qty_planned} {move.unit_of_measure}</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleValidate} disabled={saving}>
            {saving ? <><div className="spinner" /> Validating…</> : '✓ Validate & Update Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MovesPage({ type, title, description }) {
  const [moves, setMoves]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 50 });
  const [filter, setFilter]   = useState({ status: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [validateTarget, setValidateTarget] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await movesApi.list({ type, status: filter.status, page: pagination.page, limit: pagination.limit });
      setMoves(res.data);
      setPagination(p => ({ ...p, total: res.pagination.total }));
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [type, filter.status, pagination.page]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this operation?')) return;
    try { await movesApi.cancel(id); toast.info('Operation cancelled'); load(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{pagination.total} records · {description}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New {title.replace(/s$/, '')}</button>
      </div>

      <div className="filter-bar">
        <span className="text-sm text-muted">Filter by status:</span>
        <div className="tabs">
          {['', 'draft', 'waiting', 'ready', 'done', 'cancelled'].map(s => (
            <button key={s} className={`tab ${filter.status === s ? 'active' : ''}`}
              onClick={() => setFilter({ status: s })}>
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Product</th>
                {type === 'receipt'  && <th>Supplier</th>}
                {type === 'delivery' && <th>Customer</th>}
                {type !== 'receipt'  && <th>From</th>}
                {type !== 'delivery' && <th>To</th>}
                <th>Qty Planned</th>
                <th>Qty Done</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, width: '75%' }} /></td>
                  ))}</tr>
                ))
              ) : moves.length === 0 ? (
                <tr><td colSpan={10}><div className="empty-state"><p>No {type}s found</p></div></td></tr>
              ) : moves.map(m => (
                <tr key={m.id}>
                  <td><span className="ref-chip">{m.reference}</span></td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{m.product_name}</div>
                    <div className="text-xs text-muted mono">{m.sku}</div>
                  </td>
                  {type === 'receipt'  && <td className="text-sm text-muted">{m.supplier || '—'}</td>}
                  {type === 'delivery' && <td className="text-sm text-muted">{m.customer || '—'}</td>}
                  {type !== 'receipt'  && <td className="text-sm">{m.from_location_name ? `${m.from_warehouse} / ${m.from_location_name}` : '—'}</td>}
                  {type !== 'delivery' && <td className="text-sm">{m.to_location_name   ? `${m.to_warehouse} / ${m.to_location_name}`     : '—'}</td>}
                  <td className="mono">{Number(m.qty_planned).toLocaleString()} <span className="text-muted text-xs">{m.unit_of_measure}</span></td>
                  <td className="mono">{m.status === 'done' ? Number(m.qty_done).toLocaleString() : '—'}</td>
                  <td><span className={`badge ${STATUS_BADGE[m.status]}`}>{m.status}</span></td>
                  <td className="text-sm text-muted">{new Date(m.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-1">
                      {m.status !== 'done' && m.status !== 'cancelled' && (
                        <button className="btn btn-primary btn-sm" onClick={() => setValidateTarget(m)}>Validate</button>
                      )}
                      {m.status !== 'done' && m.status !== 'cancelled' && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleCancel(m.id)}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <MoveForm type={type} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />
      )}
      {validateTarget && (
        <ValidateModal move={validateTarget} onClose={() => setValidateTarget(null)} onDone={() => { setValidateTarget(null); load(); }} />
      )}
    </div>
  );
}
