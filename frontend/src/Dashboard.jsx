import React, { useState, useEffect } from 'react';
import { fetchProducts, fetchAnalytics, triggerScraper, fetchNotifications, markNotificationRead } from './api';
import { Link } from 'react-router-dom';

function Dashboard() {
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [lastNotificationId, setLastNotificationId] = useState(0);

  // Filter states
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Delay search queries by 350ms so we don't fire on every keypress
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        search: debouncedSearch,
        source,
        category,
        ...(minPrice !== '' && { min_price: parseFloat(minPrice) }),
        ...(maxPrice !== '' && { max_price: parseFloat(maxPrice) }),
      };
      const [productsData, analyticsData] = await Promise.all([
        fetchProducts(params),
        fetchAnalytics(),
      ]);
      setProducts(productsData);
      setAnalytics(analyticsData);
    } catch (err) {
      setError('Could not connect to the backend API. Is it running on port 8000?');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch whenever any active filter changes
  useEffect(() => {
    loadData();
  }, [debouncedSearch, source, category, minPrice, maxPrice]);

  // Poll for new notifications
  useEffect(() => {
    const pollNotifications = async () => {
      try {
        const activeNotifs = await fetchNotifications();
        if (activeNotifs.length > 0) {
          setNotifications(prev => {
            const newIds = activeNotifs.map(n => n.id);
            const filteredPrev = prev.filter(p => newIds.includes(p.id));
            const existingIds = filteredPrev.map(p => p.id);
            const additions = activeNotifs.filter(n => !existingIds.includes(n.id));
            
            if (additions.length > 0) {
              const maxId = Math.max(...additions.map(a => a.id));
              setLastNotificationId(prev => Math.max(prev, maxId));
            }
            
            return [...filteredPrev, ...additions];
          });
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    };
    pollNotifications();
    const interval = setInterval(pollNotifications, 4000);
    return () => clearInterval(interval);
  }, []);

  // Whenever we receive a newly generated notification ID, auto-refresh the UI data
  useEffect(() => {
    if (lastNotificationId > 0) {
      loadData();
    }
  }, [lastNotificationId]);

  const handleDismissNotification = async (id) => {
    // Optimistically remove from UI
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await markNotificationRead(id);
    } catch (err) {
      console.error("Failed to mark read", err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await triggerScraper();
      await loadData();
    } catch (err) {
      setError('Scraper trigger failed. Is the backend running?');
    } finally {
      setRefreshing(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setSource('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
  };

  if (loading && !products.length && !error) {
    return (
      <div className="p-8 text-center text-xl font-semibold text-gray-400">
        Loading Dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-0 text-gray-200">
      
      {/* Floating Notifications UI */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3">
        {notifications.map(notif => (
          <div key={notif.id} className="bg-amber-950 border border-amber-500/50 text-amber-50 p-4 rounded-2xl shadow-2xl flex items-start gap-3 w-[350px] transform transition-all hover:scale-105">
            <div className="flex-1">
              <p className="font-medium text-sm leading-snug">{notif.message}</p>
              <button 
                onClick={() => handleDismissNotification(notif.id)}
                className="mt-3 bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Acknowledge ✓
              </button>
            </div>
            <button onClick={() => handleDismissNotification(notif.id)} className="text-amber-400 hover:text-white relative -top-1">✕</button>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex justify-between items-center bg-gray-900/50 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-gray-800/50">
          <h1 className="text-3xl font-bold text-white">Price Monitor Dashboard</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            {refreshing ? 'Refreshing Data...' : 'Trigger Data Refresh'}
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center justify-between bg-red-900/40 border border-red-700/50 text-red-300 px-5 py-4 rounded-xl">
            <span className="font-medium">⚠ {error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-200 transition-colors font-bold text-lg leading-none ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Analytics Summary */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900/50 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-gray-800/50">
              <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                Products by Source
              </h2>
              <div className="space-y-3">
                {analytics.by_source.map((item) => {
                  const isSelected = source === item.source_marketplace;
                  return (
                  <button 
                    key={item.source_marketplace} 
                    onClick={() => setSource(isSelected ? '' : item.source_marketplace)}
                    className={`w-full flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-blue-900/40 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                        : 'bg-gray-800/50 border-gray-700/30 hover:bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <span className={`font-medium ${isSelected ? 'text-blue-100' : 'text-gray-200'}`}>{item.source_marketplace}</span>
                    <span className={`py-1 px-3 rounded-full text-sm font-bold border ${
                      isSelected 
                        ? 'bg-blue-500 text-white border-blue-400' 
                        : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    }`}>
                      {item.total_products} items
                    </span>
                  </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-gray-900/50 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-gray-800/50">
              <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">
                Average Price by Category
              </h2>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {analytics.by_category.map((item) => {
                  const isSelected = category === item.category;
                  return (
                  <button 
                    key={item.category} 
                    onClick={() => setCategory(isSelected ? '' : item.category)}
                    className={`w-full flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-emerald-900/40 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                        : 'bg-gray-800/50 border-gray-700/30 hover:bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <span className={`font-medium truncate mr-4 ${isSelected ? 'text-emerald-100' : 'text-gray-300'}`}>{item.category}</span>
                    <span className={`font-bold whitespace-nowrap ${isSelected ? 'text-emerald-300' : 'text-emerald-400'}`}>${item.average_price.toFixed(2)}</span>
                  </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Filters & Product Table */}
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-800/50 overflow-hidden">

          {/* Filter Bar */}
          <div className="p-4 bg-gray-900/80 border-b border-gray-800 flex flex-col md:flex-row gap-3 items-center flex-wrap">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 bg-gray-800/50 border border-gray-700 text-gray-200 placeholder-gray-500 rounded-lg w-full md:w-56 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            />

            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="px-4 py-2 bg-gray-800/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            >
              <option value="">All Marketplaces</option>
              <option value="Grailed">Grailed</option>
              <option value="Fashionphile">Fashionphile</option>
              <option value="1stdibs">1stdibs</option>
            </select>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-4 py-2 bg-gray-800/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            >
              <option value="">All Categories</option>
              {analytics?.by_category.map((c) => (
                <option key={c.category} value={c.category}>{c.category}</option>
              ))}
            </select>

            {/* Price range — wires directly to backend min_price / max_price params */}
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min $"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="px-3 py-2 bg-gray-800/50 border border-gray-700 text-gray-200 placeholder-gray-500 rounded-lg w-24 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              />
              <span className="text-gray-600">—</span>
              <input
                type="number"
                placeholder="Max $"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="px-3 py-2 bg-gray-800/50 border border-gray-700 text-gray-200 placeholder-gray-500 rounded-lg w-24 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              />
            </div>

            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-400 hover:text-white font-medium transition-colors"
            >
              Clear Filters
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-900/80 text-gray-400 text-sm uppercase tracking-wider border-b border-gray-800">
                  <th className="p-5 font-semibold">Name</th>
                  <th className="p-5 font-semibold">Category</th>
                  <th className="p-5 font-semibold">Source</th>
                  <th className="p-5 font-semibold">Price</th>
                  <th className="p-5 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {products.length > 0 ? (
                  products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-800/40 transition-colors group relative">
                      <td className="p-4 font-medium text-gray-200">
                        <span>{product.name}</span>
                      </td>
                      <td className="p-4 text-gray-400">{product.category}</td>
                      <td className="p-4">
                        <span className="bg-gray-800 border border-gray-700 text-gray-300 px-2 py-1 rounded-md text-xs font-semibold uppercase tracking-wider">
                          {product.source_marketplace}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-emerald-400">${product.current_price.toFixed(2)}</td>
                      <td className="p-4 text-right relative z-10 w-[160px]">
                        <div className="flex justify-end">
                          <Link
                            to={`/product/${product.id}`}
                            className="inline-flex items-center justify-center gap-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm w-full"
                          >
                            Chart & Details <span className="ml-1">&rarr;</span>
                          </Link>
                        </div>
                      </td>
                      <Link to={`/product/${product.id}`} className="absolute inset-0 z-0">
                        <span className="sr-only">View details for {product.name}</span>
                      </Link>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-16 text-center text-gray-500 font-medium border-t border-gray-800">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        No products found matching your filters.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Dashboard;