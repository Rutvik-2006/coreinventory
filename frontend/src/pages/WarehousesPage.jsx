import { useState, useEffect } from 'react';
import { warehousesApi } from '../utils/api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [selected, setSelected]     = useState(null);
  const [locations, setLocations]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showWHModal, setShowWHModal]   = useState(false);
  const [showLocModal, setShowLocModal] = useState(false);
  const [form, setForm] = useState({ name: '', short_code: '', address: '' });
  const [locForm, setLocForm] = useState({ name: '', short_code: '' });
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const loadWH = () => {
    warehousesApi.list().then(r => { setWarehouses(r.data); setLoading(false); });
  };
  useEffect(() => { loadWH(); }, []);

  const selectWH = async (wh) => {
    setSelected(wh);
    const r = await warehousesApi.locations(wh.id);
    setLocations(r.data);
  };

  const createWH = async () => {
    if (!form.name || !form.short_code) { toast.error('Name and short code are required'); return; }
    setSaving(true);
    try {
      await warehousesApi.create(form);
      toast.success('Warehouse created');
      setShowWHModal(false);
      setForm({ name: '', short_code: '', address: '' });
      loadWH();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const createLoc = async () => {
    if (!locForm.name || !locForm.short_code) { toast.error('Name and short code required'); return; }
    setSaving(true);
    try {
      await warehousesApi.createLocation(selected.id, { ...locForm, warehouse_id: selected.id });
      toast.success('Location created');
      setShowLocModal(false);
      setLocForm({ name: '', short_code: '' });
      const r = await warehousesApi.locations(selected.id);
      setLocations(r.data);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Warehouses</h1>
          <p className="page-subtitle">Manage warehouses and their locations</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={() => setShowWHModal(true)}>+ New Warehouse</button>}
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Warehouses list */}
        <div style={{ width: 320, flexShrink: 0 }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>WAREHOUSES</h3>
          {loading
            ? Array.from({length:3}).map((_,i) => <div key={i} className="skeleton" style={{height:72, borderRadius:10, marginBottom:8}} />)
            : warehouses.map(w => (
              <div key={w.id}
                onClick={() => selectWH(w)}
                style={{
                  background: selected?.id === w.id ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                  border: `1px solid ${selected?.id === w.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-lg)', padding: '14px 16px', cursor: 'pointer',
                  marginBottom: 8, transition: 'all 0.15s'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{w.name}</span>
                  <span className="ref-chip">{w.short_code}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {w.location_count} locations · {w.address || 'No address'}
                </div>
              </div>
            ))
          }
        </div>

        {/* Locations detail */}
        <div style={{ flex: 1 }}>
          {!selected
            ? <div className="card empty-state"><p>Select a warehouse to view its locations</p></div>
            : <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontWeight: 600 }}>Locations in {selected.name}</h3>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowLocModal(true)}>+ Add Location</button>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <table className="table">
                  <thead>
                    <tr><th>Code</th><th>Location Name</th><th>Products</th><th>Total Units</th></tr>
                  </thead>
                  <tbody>
                    {locations.length === 0
                      ? <tr><td colSpan={4}><div className="empty-state"><p>No locations yet</p></div></td></tr>
                      : locations.map(l => (
                        <tr key={l.id}>
                          <td><span className="ref-chip">{l.short_code}</span></td>
                          <td style={{ fontWeight: 500 }}>{l.name}</td>
                          <td className="mono text-sm">{l.distinct_products}</td>
                          <td className="mono">{Number(l.total_stock).toLocaleString()}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </>
          }
        </div>
      </div>

      {/* New Warehouse Modal */}
      {showWHModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowWHModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 600 }}>New Warehouse</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowWHModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Main Warehouse" />
              </div>
              <div className="form-group">
                <label className="label">Short Code *</label>
                <input className="input mono" value={form.short_code} onChange={e => setForm(f => ({...f, short_code: e.target.value.toUpperCase()}))} placeholder="MAIN" maxLength={20} />
              </div>
              <div className="form-group">
                <label className="label">Address</label>
                <textarea className="input" rows={2} value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="Full address…" style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowWHModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createWH} disabled={saving}>
                {saving ? 'Creating…' : 'Create Warehouse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Location Modal */}
      {showLocModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowLocModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 600 }}>Add Location to {selected?.name}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowLocModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="label">Location Name *</label>
                <input className="input" value={locForm.name} onChange={e => setLocForm(f => ({...f, name: e.target.value}))} placeholder="Zone A / Rack B1" />
              </div>
              <div className="form-group">
                <label className="label">Short Code *</label>
                <input className="input mono" value={locForm.short_code} onChange={e => setLocForm(f => ({...f, short_code: e.target.value.toUpperCase()}))} placeholder="ZA" maxLength={20} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLocModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createLoc} disabled={saving}>
                {saving ? 'Creating…' : 'Add Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
