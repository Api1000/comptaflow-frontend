import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Pricing from './pages/Pricing';
import Success from './pages/Success';
import Usage from './pages/Usage';
import Support from './pages/Support';
import DebugPDF from './pages/DebugPDF';
import './index.css';

function App() {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes with layout */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/usage" element={<ProtectedRoute><Usage /></ProtectedRoute>} />
          <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
          <Route path="/success" element={<ProtectedRoute><Success /></ProtectedRoute>} />
		  <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
		  <Route path="/debug" element={<ProtectedRoute><DebugPDF /></ProtectedRoute>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;