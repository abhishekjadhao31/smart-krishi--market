import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import FarmerDashboard from './pages/FarmerDashboard.jsx';
import BuyerDashboard from './pages/BuyerDashboard.jsx';
import CropUpload from './pages/CropUpload.jsx';
import Prediction from './pages/Prediction.jsx';
import MarketTrends from './pages/MarketTrends.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-krishi-50">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Farmer routes */}
          <Route
            path="/farmer"
            element={
              <ProtectedRoute role="farmer">
                <FarmerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/farmer/upload"
            element={
              <ProtectedRoute role="farmer">
                <CropUpload />
              </ProtectedRoute>
            }
          />
          <Route
            path="/farmer/prediction/:cropId"
            element={
              <ProtectedRoute role="farmer">
                <Prediction />
              </ProtectedRoute>
            }
          />

          {/* Buyer routes */}
          <Route
            path="/buyer"
            element={
              <ProtectedRoute role="buyer">
                <BuyerDashboard />
              </ProtectedRoute>
            }
          />

          {/* Shared */}
          <Route path="/market-trends" element={<MarketTrends />} />

          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
