import React, { useState, useEffect } from 'react';
import { getProducts, getAnalytics, triggerRefresh } from './api';

const Dashboard = () => {
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState({ by_source: [], by_category: [] });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, statRes] = await Promise.all([
        getProducts(),
        getAnalytics()
      ]);
      setProducts(prodRes.data);
      setAnalytics(statRes.data);
    } catch (error) {
      console.error("Error fetching data", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    alert("Triggering background scraper! Give it a few seconds and refresh the page.");
    await triggerRefresh();
  };

  if (loading) return <div className="text-xl font-bold">Loading data...</div>;

  return (
    <div>
      {/* Top Actions */}
      <div className="mb-6 flex justify-end">
        <button 
          onClick={handleRefresh}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition"
        >
          Trigger Data Refresh
        </button>
      </div>

      {/* Analytics Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Totals by Marketplace</h2>
          <ul>
            {analytics.by_source.map((stat, idx) => (
              <li key={idx} className="flex justify-between border-b py-2">
                <span>{stat.source_marketplace}</span>
                <span className="font-semibold">{stat.total_products} products</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Average Price by Category</h2>
          <ul>
            {analytics.by_category.map((stat, idx) => (
              <li key={idx} className="flex justify-between border-b py-2">
                <span className="capitalize">{stat.category}</span>
                <span className="font-semibold">${stat.average_price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h2 className="text-xl font-bold p-6 bg-gray-50 border-b">Tracked Products</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marketplace</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Price</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-6 py-4 text-sm font-medium text-blue-600">
                  <a href={p.url} target="_blank" rel="noreferrer">{p.name}</a>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{p.source_marketplace}</td>
                <td className="px-6 py-4 text-sm text-gray-500 capitalize">{p.category}</td>
                <td className="px-6 py-4 text-sm font-bold text-green-600">${p.current_price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;