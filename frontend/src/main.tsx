import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import App from './App';
import './index.css';

// Configure Amplify - Update these values after deployment
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID || 'YOUR_USER_POOL_ID',
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || 'YOUR_CLIENT_ID',
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true,
      },
      userAttributes: {
        name: {
          required: true,
        },
      },
    },
  },
  API: {
    REST: {
      NewsAPI: {
        endpoint: import.meta.env.VITE_API_ENDPOINT || 'http://localhost:3001',
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
