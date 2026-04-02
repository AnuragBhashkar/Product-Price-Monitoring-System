import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchProductDetails } from './api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, ExternalLink, TrendingUp, Tag, ShieldCheck } from 'lucide-react';

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetchProductDetails(id);
        
        // Format the date for the chart
        const formattedHistory = response.price_history.map(entry => ({
          ...entry,
          formattedDate: new Date(entry.detected_at).toLocaleDateString('en-US', {
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        }));

        setData({
          ...response,
          price_history: formattedHistory
        });
      } catch (error) {
        console.error("Error fetching product details:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-transparent flex items-center justify-center text-xl font-medium text-gray-500">Loading Product Details...</div>;
  }

  if (!data || !data.product) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-8">
        <h2 className="text-2xl font-bold text-gray-300 mb-4">Product Not Found</h2>
        <button onClick={() => navigate('/')} className="text-blue-500 hover:text-blue-400 hover:underline flex items-center gap-2 transition-colors">
          <ArrowLeft size={20} /> Back to Dashboard
        </button>
      </div>
    );
  }

  const { product, price_history } = data;

  return (
    <div className="min-h-screen bg-transparent p-0 text-gray-200">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Navigation */}
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-medium mb-2"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>

        {/* Product Header Card */}
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-800/50 overflow-hidden">
          <div className="p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 uppercase tracking-wide shadow-inner">
                    <ShieldCheck size={16} />
                    {product.source_marketplace}
                  </span>
                  <span className="bg-gray-800 text-gray-300 border border-gray-700 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5">
                    <Tag size={16} />
                    {product.category}
                  </span>
                </div>
                
                <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                  {product.name}
                </h1>
                
                <p className="text-sm text-gray-500 font-mono">ID: {product.source_product_id}</p>
              </div>

              <div className="flex flex-col items-start md:items-end gap-4 min-w-[200px]">
                <div className="text-left md:text-right">
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Current Price</p>
                  <p className="text-4xl font-bold text-emerald-400 drop-shadow-sm">${product.current_price.toFixed(2)}</p>
                </div>
                
                <a 
                  href={product.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-all w-full justify-center md:w-auto shadow-lg hover:shadow-blue-500/25"
                >
                  View on {product.source_marketplace}
                  <ExternalLink size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Price History Chart Section */}
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-800/50 p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <TrendingUp className="text-blue-400" size={28} />
              Price History Timeline
            </h2>
            <div className="text-sm font-medium text-gray-400 bg-gray-800/50 border border-gray-700/50 px-4 py-2 rounded-lg">
              {price_history.length} price checks recorded
            </div>
          </div>

          {price_history.length > 0 ? (
            <div className="h-[400px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={price_history} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                  <XAxis 
                    dataKey="formattedDate" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(value) => `$${value}`}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', borderRadius: '12px', border: '1px solid #374151', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)' }}
                    itemStyle={{ color: '#06b6d4', fontWeight: 'bold' }}
                    formatter={(value) => [`$${value}`, 'Price']}
                    labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#06b6d4" 
                    strokeWidth={4}
                    dot={{ fill: '#111827', strokeWidth: 2, r: 5, stroke: '#06b6d4' }}
                    activeDot={{ r: 8, fill: '#22d3ee', stroke: '#111827', strokeWidth: 3 }}
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-gray-800/30 rounded-2xl border border-dashed border-gray-700 p-12 text-center">
              <p className="text-gray-400 font-medium text-lg">Not enough historical data to generate a chart yet.</p>
              <p className="text-sm text-gray-500 mt-2">Wait for the scraper to detect price changes over time!</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default ProductDetail;
