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

export const getProducts = () => apiClient.get('/products/');
export const getAnalytics = () => apiClient.get('/analytics/'); 
export const triggerRefresh = () => apiClient.post('/scraper/run'); // Adjust to match your exact scraper route if needed