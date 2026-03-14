import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from './Sidebar';
import styles from './Layout.module.css';

export default function Layout() {
  const { user, loading } = useAuth();
  if (loading) return <div className={styles.loading}><div className="spinner" /></div>;
  if (!user)   return <Navigate to="/login" replace />;
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
