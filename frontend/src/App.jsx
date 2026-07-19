import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import Layout from './components/shared/Layout';
import { LoginPage, RegisterPage, ForgotPasswordPage } from './pages/AuthPages';
import DashboardPage    from './pages/DashboardPage';
import ProductsPage     from './pages/ProductsPage';
import MovesPage        from './pages/MovesPage';
import WarehousesPage   from './pages/WarehousesPage';
import AdjustmentsPage  from './pages/AdjustmentsPage';
import HistoryPage      from './pages/HistoryPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/login"           element={<LoginPage />} />
            <Route path="/register"        element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Protected */}
            <Route element={<Layout />}>
              <Route path="/"             element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"    element={<DashboardPage />} />
              <Route path="/products"     element={<ProductsPage />} />
              <Route path="/receipts"     element={<MovesPage type="receipt"  title="Receipts"   description="Incoming goods from vendors" />} />
              <Route path="/deliveries"   element={<MovesPage type="delivery" title="Deliveries" description="Outgoing stock to customers" />} />
              <Route path="/transfers"    element={<MovesPage type="internal" title="Transfers"  description="Internal stock movements" />} />
              <Route path="/adjustments"  element={<AdjustmentsPage />} />
              <Route path="/history"      element={<HistoryPage />} />
              <Route path="/warehouses"   element={<WarehousesPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
