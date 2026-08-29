import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from './context/AuthContext.jsx'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "4122489040-c4846ebgo7hacshcd5q29abl42ps1fch.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId || "4122489040-c4846ebgo7hacshcd5q29abl42ps1fch.apps.googleusercontent.com"}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>,
)
