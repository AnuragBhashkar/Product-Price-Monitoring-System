import React, { useState, useEffect } from 'react';
import { fetchProducts, fetchAnalytics, triggerScraper } from './api';
import { Link } from 'react-router-dom';

function Dashboard() {
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New Filter States
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      // Pass our filters to the API!
      const [productsData, analyticsData] = await Promise.all([
        fetchProducts({ search, source, category }),
        fetchAnalytics()
      ]);
      setProducts(productsData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  // Re-fetch data whenever a filter changes
  useEffect(() => {
    loadData();
  }, [search, source, category]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await triggerScraper();
      await loadData();
    } catch (error) {
      console.error("Error triggering refresh:", error);
    }
    setRefreshing(false);
  };

  if (loading && !products.length) return <div className="p-8 text-center text-xl font-semibold text-gray-400">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-transparent p-0 text-gray-200">
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

        {/* Analytics Summary */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900/50 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-gray-800/50">
              <h2 className="text-lg font-semibold text-gray-400 mb-4 uppercase tracking-wider text-sm flex items-center gap-2">Products by Source</h2>
              <div className="space-y-3">
                {analytics.by_source.map((item) => (
                  <div key={item.source} className="flex justify-between items-center p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
                    <span className="font-medium text-gray-200">{item.source}</span>
                    <span className="bg-blue-500/20 text-blue-400 py-1 px-3 rounded-full text-sm font-bold border border-blue-500/30">{item.count} items</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gray-900/50 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-gray-800/50">
              <h2 className="text-lg font-semibold text-gray-400 mb-4 uppercase tracking-wider text-sm">Average Price by Category</h2>
              <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {analytics.by_category.map((item) => (
                  <div key={item.category} className="flex justify-between items-center p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
                    <span className="font-medium truncate mr-4 text-gray-300">{item.category}</span>
                    <span className="text-emerald-400 font-bold whitespace-nowrap">${item.average_price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters & Product Table */}
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-800/50 overflow-hidden">
          
          {/* FILTER BAR */}
          <div className="p-4 bg-gray-900/80 border-b border-gray-800 flex flex-col md:flex-row gap-4 items-center justify-between">
            <input 
              type="text" 
              placeholder="Search products..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 bg-gray-800/50 border border-gray-700 text-gray-200 placeholder-gray-500 rounded-lg w-full md:w-1/3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            />
            <div className="flex gap-4 w-full md:w-auto">
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
                {/* Dynamically generating categories from analytics */}
                {analytics?.by_category.map(c => (
                  <option key={c.category} value={c.category}>{c.category}</option>
                ))}
              </select>
              <button 
                onClick={() => {setSearch(''); setSource(''); setCategory('');}}
                className="px-4 py-2 text-gray-400 hover:text-white font-medium transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* TABLE */}
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
                      <td className="p-5 font-medium text-gray-200 flex flex-col">
                        <span>{product.name}</span>
                        <span className="text-xs text-gray-500 font-mono mt-1 hidden lg:block">ID: {product.source_product_id}</span>
                      </td>
                      <td className="p-5 text-gray-400">{product.category}</td>
                      <td className="p-5">
                        <span className="bg-gray-800 border border-gray-700 text-gray-300 px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider">
                          {product.source_marketplace}
                        </span>
                      </td>
                      <td className="p-5 font-bold text-emerald-400">${product.current_price.toFixed(2)}</td>
                      <td className="p-5 text-right relative z-10">
                        <Link 
                          to={`/product/${product.id}`}
                          className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm"
                        >
                          Chart & Details <span>&rarr;</span>
                        </Link>
                      </td>
                      {/* Entire row is a clickable invisible overlay to make UX easier */}
                      <Link to={`/product/${product.id}`} className="absolute inset-0 z-0"><span className="sr-only">View Details for {product.name}</span></Link>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-16 text-center text-gray-500 font-medium border-t border-gray-800">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
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