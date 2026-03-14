import { useState, useEffect } from 'react';
import { stockApi, productsApi, warehousesApi } from '../utils/api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

export default function AdjustmentsPage() {
  const [products,  setProducts]  = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ product_id: '', location_id: '', new_qty: '', notes: '' });
  const [currentStock, setCurrentStock] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving]  = useState(false);
  const [history, setHistory] = useState([]);
  const toast = useToast();
  const { user } = useAuth();
  const canAdjust = ['admin', 'manager'].includes(user?.role);

  useEffect(() => {
    Promise.all([productsApi.list({ limit: 200 }), warehousesApi.allLocations()])
      .then(([p, l]) => { setProducts(p.data); setLocations(l.data); });
    loadHistory();
  }, []);

  const loadHistory = () => {
    const { movesApi } = require('../utils/api');
    movesApi.list({ type: 'adjustment', limit: 20 }).then(r => setHistory(r.data));
  };

  // When product + location both set, show current stock
  useEffect(() => {
    if (!form.product_id || !form.location_id) { setCurrentStock(null); return; }
    productsApi.get(form.product_id).then(r => {
      const snap = r.data.stock_by_location?.find(s => {
        // match by location name isn't ideal but works with what we have
        return locations.find(l => l.id === form.location_id && l.name === s.location_name);
      });
      setCurrentStock(snap?.qty_on_hand ?? 0);
    });
  }, [form.product_id, form.location_id]);

  const setF = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({...er, [k]: ''})); };

  const validate = () => {
    const e = {};
    if (!form.product_id)  e.product_id  = 'Select a product';
    if (!form.location_id) e.location_id = 'Select a location';
    if (form.new_qty === '' || Number(form.new_qty) < 0) e.new_qty = 'Enter a valid quantity (≥ 0)';
    return e;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await stockApi.adjust({
        product_id:  form.product_id,
        location_id: form.location_id,
        new_qty:     Number(form.new_qty),
        notes:       form.notes || 'Manual adjustment',
      });
      toast.success('Stock adjusted successfully');
      setForm({ product_id: '', location_id: '', new_qty: '', notes: '' });
      setCurrentStock(null);
      loadHistory();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const diff = currentStock !== null && form.new_qty !== '' ? Number(form.new_qty) - currentStock : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Adjustments</h1>
          <p className="page-subtitle">Fix mismatches between recorded and physical stock</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Adjustment form */}
        <div className="card" style={{ width: 400, flexShrink: 0 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 20 }}>New Adjustment</h3>
          {!canAdjust && (
            <div style={{ background: 'var(--yellow-dim)', border: '1px solid var(--yellow)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: 'var(--yellow)' }}>
              Only managers and admins can make adjustments.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: canAdjust ? 1 : 0.5 }}>
            <div className="form-group">
              <label className="label">Product *</label>
              <select className={`input select ${errors.product_id ? 'error' : ''}`} value={form.product_id} onChange={setF('product_id')} disabled={!canAdjust}>
                <option value="">Select product…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
              {errors.product_id && <span className="error-msg">{errors.product_id}</span>}
            </div>
            <div className="form-group">
              <label className="label">Location *</label>
              <select className={`input select ${errors.location_id ? 'error' : ''}`} value={form.location_id} onChange={setF('location_id')} disabled={!canAdjust}>
                <option value="">Select location…</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.warehouse_name} — {l.name}</option>)}
              </select>
              {errors.location_id && <span className="error-msg">{errors.location_id}</span>}
            </div>

            {currentStock !== null && (
              <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                <span className="text-xs text-muted">Current recorded stock: </span>
                <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentStock}</span>
              </div>
            )}

            <div className="form-group">
              <label className="label">New Quantity (physical count) *</label>
              <input className={`input ${errors.new_qty ? 'error' : ''}`} type="number" min="0" step="any"
                value={form.new_qty} onChange={setF('new_qty')} placeholder="0" disabled={!canAdjust} />
              {errors.new_qty && <span className="error-msg">{errors.new_qty}</span>}
              {diff !== null && (
                <span className="helper-msg" style={{ color: diff === 0 ? 'var(--text-muted)' : diff > 0 ? 'var(--green)' : 'var(--red)' }}>
                  Adjustment: {diff > 0 ? '+' : ''}{diff} units
                </span>
              )}
            </div>
            <div className="form-group">
              <label className="label">Reason / Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={setF('notes')} placeholder="Damaged goods, count discrepancy…" style={{ resize: 'vertical' }} disabled={!canAdjust} />
            </div>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={!canAdjust || saving}>
              {saving ? <><div className="spinner" /> Adjusting…</> : 'Apply Adjustment'}
            </button>
          </div>
        </div>

        {/* Recent adjustments */}
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>RECENT ADJUSTMENTS</h3>
          <div className="card" style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr><th>Reference</th><th>Product</th><th>Qty Done</th><th>Date</th><th>By</th></tr>
              </thead>
              <tbody>
                {history.length === 0
                  ? <tr><td colSpan={5}><div className="empty-state"><p>No adjustments yet</p></div></td></tr>
                  : history.map(h => (
                    <tr key={h.id}>
                      <td><span className="ref-chip">{h.reference}</span></td>
                      <td style={{ fontWeight: 500 }}>{h.product_name}</td>
                      <td className={`mono ${Number(h.qty_done) >= 0 ? '' : ''}`}>{h.direction === 'out' ? '-' : '+'}{Number(h.qty_done).toLocaleString()} {h.unit_of_measure}</td>
                      <td className="text-sm text-muted">{new Date(h.created_at).toLocaleDateString()}</td>
                      <td className="text-sm text-muted">{h.created_by_name}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
