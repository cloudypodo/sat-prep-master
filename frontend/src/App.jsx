import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import TestSetup from './pages/TestSetup.jsx';
import TestTaking from './pages/TestTaking.jsx';
import TestResults from './pages/TestResults.jsx';
import TestReview from './pages/TestReview.jsx';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/test/setup" element={<PrivateRoute><TestSetup /></PrivateRoute>} />
          <Route path="/test/:testId" element={<PrivateRoute><TestTaking /></PrivateRoute>} />
          <Route path="/results/:testId" element={<PrivateRoute><TestResults /></PrivateRoute>} />
          <Route path="/review/:testId" element={<PrivateRoute><TestReview /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
