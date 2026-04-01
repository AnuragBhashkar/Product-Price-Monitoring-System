import React, { useState, useEffect } from 'react';
import { fetchProducts, fetchAnalytics, triggerScraper } from './api';

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

  if (loading && !products.length) return <div className="p-8 text-center text-xl font-semibold">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-gray-800">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h1 className="text-3xl font-bold text-gray-900">Price Monitor Dashboard</h1>
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
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-500 mb-4 uppercase tracking-wider text-sm">Products by Source</h2>
              <div className="space-y-3">
                {analytics.by_source.map((item) => (
                  <div key={item.source} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{item.source}</span>
                    <span className="bg-blue-100 text-blue-800 py-1 px-3 rounded-full text-sm font-bold">{item.count} items</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-500 mb-4 uppercase tracking-wider text-sm">Average Price by Category</h2>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                {analytics.by_category.map((item) => (
                  <div key={item.category} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium truncate mr-4">{item.category}</span>
                    <span className="text-green-600 font-bold whitespace-nowrap">${item.average_price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters & Product Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          
          {/* FILTER BAR */}
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
            <input 
              type="text" 
              placeholder="Search products..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg w-full md:w-1/3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <div className="flex gap-4 w-full md:w-auto">
              <select 
                value={source} 
                onChange={(e) => setSource(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Marketplaces</option>
                <option value="Grailed">Grailed</option>
                <option value="Fashionphile">Fashionphile</option>
                <option value="1stdibs">1stdibs</option>
              </select>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Categories</option>
                {/* Dynamically generating categories from analytics */}
                {analytics?.by_category.map(c => (
                  <option key={c.category} value={c.category}>{c.category}</option>
                ))}
              </select>
              <button 
                onClick={() => {setSearch(''); setSource(''); setCategory('');}}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium"
              >
                Clear
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white text-gray-500 text-sm uppercase tracking-wider border-b border-gray-200">
                  <th className="p-4 font-semibold">Name</th>
                  <th className="p-4 font-semibold">Category</th>
                  <th className="p-4 font-semibold">Source</th>
                  <th className="p-4 font-semibold">Price</th>
                  <th className="p-4 font-semibold text-right">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.length > 0 ? (
                  products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-medium text-gray-900">{product.name}</td>
                      <td className="p-4 text-gray-600">{product.category}</td>
                      <td className="p-4 text-gray-600">
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-semibold uppercase">
                          {product.source_marketplace}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-green-600">${product.current_price.toFixed(2)}</td>
                      <td className="p-4 text-right">
                        <a 
                          href={product.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                        >
                          View ↗
                        </a>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500 font-medium">
                      No products found matching your filters.
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