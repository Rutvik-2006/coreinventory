import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import styles from './Dashboard.module.css';

const STATUS_COLOR = { draft: 'badge-draft', waiting: 'badge-waiting', ready: 'badge-ready', done: 'badge-done', cancelled: 'badge-cancelled' };
const TYPE_COLOR   = { receipt: 'badge-receipt', delivery: 'badge-delivery', internal: 'badge-internal', adjustment: 'badge-adjustment' };

export default function DashboardPage() {
  const [kpis, setKpis]         = useState(null);
  const [overview, setOverview] = useState([]);
  const [loading, setLoading]   = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([dashboardApi.kpis(), dashboardApi.overview()])
      .then(([k, o]) => { setKpis(k.data); setOverview(o.data); })
      .finally(() => setLoading(false));
  }, []);

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) return <div className={styles.loadingPage}><div className="spinner" /></div>;

  const STATS = [
    { label: 'Total Products',     value: kpis?.total_products ?? 0,     color: 'accent',  sub: 'active in catalog',       action: () => navigate('/products') },
    { label: 'Low Stock Items',    value: kpis?.low_stock_count ?? 0,    color: 'red',     sub: 'at or below reorder point',action: () => navigate('/products?low_stock=true') },
    { label: 'Pending Receipts',   value: kpis?.pending_receipts ?? 0,   color: 'green',   sub: 'awaiting validation',      action: () => navigate('/receipts') },
    { label: 'Pending Deliveries', value: kpis?.pending_deliveries ?? 0, color: 'purple',  sub: 'to be dispatched',         action: () => navigate('/deliveries') },
    { label: 'Transfers Pending',  value: kpis?.pending_transfers ?? 0,  color: 'blue',    sub: 'internal moves pending',   action: () => navigate('/transfers') },
  ];

  return (
    <div className="page">
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className="page-title">{greet()}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Here's what's happening in your warehouse today.</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/receipts')}>+ New Receipt</button>
          <button className="btn btn-primary btn-sm"  onClick={() => navigate('/deliveries')}>+ New Delivery</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.statsGrid}>
        {STATS.map(({ label, value, color, sub, action }) => (
          <div key={label} className={`stat-card ${color}`} onClick={action} style={{ cursor: 'pointer' }}>
            <span className="stat-label">{label}</span>
            <span className="stat-value" style={{ color: `var(--${color})` }}>{value}</span>
            <span className="stat-sub">{sub}</span>
          </div>
        ))}
      </div>

      <div className={styles.body}>
        {/* Recent Activity */}
        <div className="card" style={{ flex: 2 }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Activity</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>View all →</button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {kpis?.recent_activity?.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No activity yet</td></tr>
                ) : kpis?.recent_activity?.map(row => (
                  <tr key={row.reference}>
                    <td><span className="ref-chip">{row.reference}</span></td>
                    <td className="truncate" style={{ maxWidth: 140 }}>{row.product_name}</td>
                    <td><span className={`badge ${TYPE_COLOR[row.type]}`}>{row.type}</span></td>
                    <td className="mono">{Number(row.qty_planned).toLocaleString()} {row.unit_of_measure}</td>
                    <td><span className={`badge ${STATUS_COLOR[row.status]}`}>{row.status}</span></td>
                    <td className="text-muted text-sm">{new Date(row.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Warehouse Overview */}
        <div className="card" style={{ flex: 1 }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Warehouses</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/warehouses')}>Manage →</button>
          </div>
          {overview.length === 0
            ? <div className="empty-state"><p>No stock data</p></div>
            : overview.map(w => (
              <div key={w.short_code} className={styles.warehouseRow}>
                <div className={styles.whCode}>{w.short_code}</div>
                <div className={styles.whInfo}>
                  <span className={styles.whName}>{w.warehouse_name}</span>
                  <span className="text-muted text-xs">{w.distinct_products} products</span>
                </div>
                <div className={styles.whUnits}>
                  <span className="mono">{Number(w.total_units).toLocaleString()}</span>
                  <span className="text-muted text-xs">units</span>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
