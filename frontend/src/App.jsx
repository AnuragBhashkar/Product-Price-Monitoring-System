import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard.jsx';

import ProductDetail from './ProductDetail.jsx';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-sans selection:bg-blue-500/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Entrupy Price Monitor
            </h1>
          </div>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/product/:id" element={<ProductDetail />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;