import { useState, useEffect, useCallback } from 'react';
import { productsApi } from '../utils/api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import styles from './Products.module.css';

const EMPTY = { name: '', sku: '', category_id: '', unit_of_measure: 'pcs', reorder_point: 0, reorder_qty: 0, description: '' };
const UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'metre', 'm²', 'pair', 'box', 'roll', 'set'];

export default function ProductsPage() {
  const [products, setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 50 });
  const [filters, setFilters]     = useState({ search: '', category_id: '', low_stock: '' });
  const [modal, setModal]         = useState(null); // null | 'create' | 'edit' | 'detail'
  const [selected, setSelected]   = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving]       = useState(false);
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = ['admin', 'manager'].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.list({ ...filters, page: pagination.page, limit: pagination.limit });
      setProducts(res.data);
      setPagination(p => ({ ...p, total: res.pagination.total }));
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [filters, pagination.page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { productsApi.categories().then(r => setCategories(r.data)); }, []);

  const openCreate = () => { setForm(EMPTY); setFormErrors({}); setModal('create'); };
  const openEdit   = (p) => { setForm({ ...p, category_id: p.category_id || '' }); setFormErrors({}); setModal('edit'); };
  const openDetail = async (p) => {
    const res = await productsApi.get(p.id);
    setSelected(res.data); setModal('detail');
  };

  const validate = () => {
    const e = {};
    if (!form.name || form.name.length < 2) e.name = 'Name required (min 2 chars)';
    if (!form.sku  || form.sku.length  < 2) e.sku  = 'SKU required (min 2 chars)';
    if (form.reorder_point < 0) e.reorder_point = 'Must be ≥ 0';
    return e;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true);
    try {
      const payload = { ...form, reorder_point: Number(form.reorder_point), reorder_qty: Number(form.reorder_qty),
        category_id: form.category_id || null };
      if (modal === 'create') { await productsApi.create(payload); toast.success('Product created'); }
      else { await productsApi.update(form.id, payload); toast.success('Product updated'); }
      setModal(null); load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    try { await productsApi.remove(id); toast.success('Product deleted'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const setF = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setFormErrors(er => ({ ...er, [k]: '' })); };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{pagination.total} products in catalog</p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={openCreate}>+ New Product</button>}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <SearchIcon />
          <input className="input" placeholder="Search name or SKU…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        </div>
        <select className="input select" style={{ width: 180 }}
          value={filters.category_id}
          onChange={e => setFilters(f => ({ ...f, category_id: e.target.value }))}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input select" style={{ width: 160 }}
          value={filters.low_stock}
          onChange={e => setFilters(f => ({ ...f, low_stock: e.target.value }))}>
          <option value="">All Stock</option>
          <option value="true">Low Stock Only</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Total Stock</th>
                <th>Reorder Point</th>
                <th>Status</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: canEdit ? 8 : 7 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 18, width: '80%' }} /></td>
                  ))}</tr>
                ))
              ) : products.length === 0 ? (
                <tr><td colSpan={canEdit ? 8 : 7}>
                  <div className="empty-state"><p>No products found</p></div>
                </td></tr>
              ) : products.map(p => (
                <tr key={p.id}>
                  <td><span className="ref-chip">{p.sku}</span></td>
                  <td>
                    <button className={styles.nameLink} onClick={() => openDetail(p)}>{p.name}</button>
                    {p.description && <div className="text-xs text-muted truncate" style={{ maxWidth: 200 }}>{p.description}</div>}
                  </td>
                  <td className="text-sm text-muted">{p.category_name || '—'}</td>
                  <td className="mono text-sm">{p.unit_of_measure}</td>
                  <td>
                    <span className={`mono ${p.is_low_stock ? styles.lowStock : ''}`}>
                      {Number(p.total_stock).toLocaleString()}
                    </span>
                  </td>
                  <td className="mono text-sm text-muted">{Number(p.reorder_point).toLocaleString()}</td>
                  <td>
                    {p.is_low_stock
                      ? <span className="badge badge-waiting">Low Stock</span>
                      : Number(p.total_stock) === 0
                        ? <span className="badge badge-cancelled">Out of Stock</span>
                        : <span className="badge badge-done">In Stock</span>}
                  </td>
                  {canEdit && (
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>
                        {user?.role === 'admin' &&
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Del</button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3 style={{ fontWeight: 600 }}>{modal === 'create' ? 'New Product' : 'Edit Product'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="label">Product Name *</label>
                  <input className={`input ${formErrors.name ? 'error' : ''}`} value={form.name} onChange={setF('name')} placeholder="Steel Rods 10mm" />
                  {formErrors.name && <span className="error-msg">{formErrors.name}</span>}
                </div>
                <div className="form-group">
                  <label className="label">SKU / Code *</label>
                  <input className={`input mono ${formErrors.sku ? 'error' : ''}`} value={form.sku} onChange={setF('sku')} placeholder="STL-ROD-10" />
                  {formErrors.sku && <span className="error-msg">{formErrors.sku}</span>}
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="label">Category</label>
                  <select className="input select" value={form.category_id} onChange={setF('category_id')}>
                    <option value="">Uncategorized</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Unit of Measure</label>
                  <select className="input select" value={form.unit_of_measure} onChange={setF('unit_of_measure')}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="label">Reorder Point</label>
                  <input className="input" type="number" min="0" value={form.reorder_point} onChange={setF('reorder_point')} />
                  {formErrors.reorder_point && <span className="error-msg">{formErrors.reorder_point}</span>}
                </div>
                <div className="form-group">
                  <label className="label">Reorder Qty</label>
                  <input className="input" type="number" min="0" value={form.reorder_qty} onChange={setF('reorder_qty')} />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description || ''} onChange={setF('description')} placeholder="Optional description…" style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <><div className="spinner" /> Saving…</> : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {modal === 'detail' && selected && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontWeight: 600 }}>{selected.name}</h3>
                <span className="ref-chip">{selected.sku}</span>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-3" style={{ marginBottom: 20 }}>
                <div className={styles.detailStat}>
                  <span className="stat-label">Unit</span>
                  <span className="mono">{selected.unit_of_measure}</span>
                </div>
                <div className={styles.detailStat}>
                  <span className="stat-label">Reorder Point</span>
                  <span className="mono">{selected.reorder_point}</span>
                </div>
                <div className={styles.detailStat}>
                  <span className="stat-label">Category</span>
                  <span>{selected.category_name || '—'}</span>
                </div>
              </div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>STOCK BY LOCATION</h4>
              {selected.stock_by_location?.length === 0
                ? <div className="empty-state" style={{ padding: '24px 0' }}><p>No stock recorded</p></div>
                : <table className="table">
                    <thead><tr><th>Location</th><th>Warehouse</th><th>Qty On Hand</th></tr></thead>
                    <tbody>
                      {selected.stock_by_location?.map(s => (
                        <tr key={s.location_name}>
                          <td>{s.location_name} <span className="text-muted text-xs">({s.short_code})</span></td>
                          <td className="text-muted text-sm">{s.warehouse_name}</td>
                          <td className="mono font-semibold">{Number(s.qty_on_hand).toLocaleString()} {selected.unit_of_measure}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);
