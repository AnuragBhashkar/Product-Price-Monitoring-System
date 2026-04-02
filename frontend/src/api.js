import axios from 'axios';

// Make sure this matches the port your FastAPI server runs on (usually 8000)
const API_URL = 'http://localhost:8000'; 
const API_KEY = 'test_secret_key'; 

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  }
});

// We map 'filters' directly to axios 'params' - axios handles the ?source=... automatically!
export const fetchProducts = async (filters = {}) => {
    const response = await apiClient.get('/products/', { params: filters });
    return response.data; // Axios automatically parses the JSON
};

export const fetchAnalytics = async () => {
    const response = await apiClient.get('/analytics/');
    return response.data;
}; 

export const triggerScraper = async () => {
    const response = await apiClient.post('/scraper/run');
    return response.data;
};

export const fetchProductDetails = async (productId) => {
    const response = await apiClient.get(`/products/${productId}`);
    return response.data;
};