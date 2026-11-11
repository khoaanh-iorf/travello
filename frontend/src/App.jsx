import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./utils/ProtectedRoute";

// Auth
import LoginPage from "./pages/auth/LoginPage";

// Pages
import DashboardPage     from "./pages/dashboard/DashboardPage";
import UserListPage      from "./pages/users/UserListPage";
import LocationListPage  from "./pages/locations/LocationListPage";
import RouteListPage     from "./pages/routes/RouteListPage";
import PromotionListPage from "./pages/promotions/PromotionListPage";
import BookingListPage   from "./pages/bookings/BookingListPage";
import BookingDetailPage from "./pages/bookings/BookingDetailPage";
import SupplierListPage  from "./pages/suppliers/SupplierListPage";
import CmsPage           from "./pages/cms/CmsPage";
import SupportListPage   from "./pages/support/SupportListPage";
import SupportDetailPage from "./pages/support/SupportDetailPage";
import PaymentListPage   from "./pages/payments/PaymentListPage";
import TripListPage     from "./pages/trips/TripListPage";
import TripDetailPage   from "./pages/trips/TripDetailPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/admin/login" element={<LoginPage />} />

        {/* Redirect root → dashboard */}
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

        {/* Protected admin routes */}
        <Route path="/admin/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><UserListPage /></ProtectedRoute>} />
        <Route path="/admin/locations" element={<ProtectedRoute><LocationListPage /></ProtectedRoute>} />
        <Route path="/admin/routes" element={<ProtectedRoute><RouteListPage /></ProtectedRoute>} />
        <Route path="/admin/trips" element={<ProtectedRoute><TripListPage /></ProtectedRoute>} />
        <Route path="/admin/trips/:id" element={<ProtectedRoute><TripDetailPage /></ProtectedRoute>} />
        <Route path="/admin/promotions" element={<ProtectedRoute><PromotionListPage /></ProtectedRoute>} />
        <Route path="/admin/bookings" element={<ProtectedRoute><BookingListPage /></ProtectedRoute>} />
        <Route path="/admin/bookings/:id" element={<ProtectedRoute><BookingDetailPage /></ProtectedRoute>} />
        <Route path="/admin/suppliers" element={<ProtectedRoute><SupplierListPage /></ProtectedRoute>} />
        <Route path="/admin/cms" element={<ProtectedRoute><CmsPage /></ProtectedRoute>} />
        <Route path="/admin/payments" element={<ProtectedRoute><PaymentListPage /></ProtectedRoute>} />
        <Route path="/admin/support" element={<ProtectedRoute><SupportListPage /></ProtectedRoute>} />
        <Route path="/admin/support/:id" element={<ProtectedRoute><SupportDetailPage /></ProtectedRoute>} />

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
