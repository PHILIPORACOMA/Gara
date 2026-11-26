import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Search from './pages/Search.jsx';
import ProPublicProfile from './pages/ProPublicProfile.jsx';
import NotFound from './pages/NotFound.jsx';
import ProLayout from './pages/pro/ProLayout.jsx';
import ProOverview from './pages/pro/ProOverview.jsx';
import ProProfile from './pages/pro/ProProfile.jsx';
import ProServices from './pages/pro/ProServices.jsx';
import ProPortfolio from './pages/pro/ProPortfolio.jsx';
import ProAvailability from './pages/pro/ProAvailability.jsx';
import ProVerification from './pages/pro/ProVerification.jsx';
import ProBookings from './pages/pro/ProBookings.jsx';
import ProEarnings from './pages/pro/ProEarnings.jsx';
import BookingFlow from './pages/BookingFlow.jsx';
import MyBookings from './pages/MyBookings.jsx';
import Notifications from './pages/Notifications.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import AdminDeposits from './pages/admin/AdminDeposits.jsx';
import AdminBookings from './pages/admin/AdminBookings.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminVerifications from './pages/admin/AdminVerifications.jsx';
import { BOOKINGS_ENABLED } from './lib/features.js';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="search" element={<Search />} />
            <Route path="pros/:id" element={<ProPublicProfile />} />

            <Route element={<ProtectedRoute />}>
              <Route path="notifications" element={<Notifications />} />
            </Route>

            {/* Booking screens: hidden in the discovery version (workbook v3). */}
            {BOOKINGS_ENABLED && (
              <Route element={<ProtectedRoute roles={['CUSTOMER']} />}>
                <Route path="pros/:id/book" element={<BookingFlow />} />
                <Route path="bookings" element={<MyBookings />} />
                <Route path="bookings/:id" element={<BookingDetail />} />
              </Route>
            )}

            <Route element={<ProtectedRoute roles={['PROFESSIONAL']} />}>
              <Route path="pro" element={<ProLayout />}>
                <Route index element={<ProOverview />} />
                {BOOKINGS_ENABLED && <Route path="bookings" element={<ProBookings />} />}
                {BOOKINGS_ENABLED && <Route path="earnings" element={<ProEarnings />} />}
                <Route path="profile" element={<ProProfile />} />
                <Route path="services" element={<ProServices />} />
                <Route path="portfolio" element={<ProPortfolio />} />
                <Route path="availability" element={<ProAvailability />} />
                <Route path="verification" element={<ProVerification />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<AdminOverview />} />
                <Route path="verifications" element={<AdminVerifications />} />
                {BOOKINGS_ENABLED && <Route path="deposits" element={<AdminDeposits />} />}
                {BOOKINGS_ENABLED && <Route path="bookings" element={<AdminBookings />} />}
                {BOOKINGS_ENABLED && <Route path="settings" element={<AdminSettings />} />}
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
