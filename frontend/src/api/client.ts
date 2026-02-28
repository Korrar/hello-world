import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  paramsSerializer: {
    indexes: null, // serialize arrays as ids=1&ids=2 (not ids[]=1&ids[]=2)
  },
});

export default api;
