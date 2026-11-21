import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import Crew from './components/Crew.jsx';
import './index.css';

const isCrewPage = window.location.pathname.replace(/\/+$/, '') === '/crew';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>{isCrewPage ? <Crew /> : <App />}</React.StrictMode>,
);
