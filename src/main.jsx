// src/main.jsx
//
// This is the JavaScript entry point for the app.
// React attaches itself to the <div id="root"> in index.html from here.
// We also import our global CSS so Tailwind and custom styles load on every page.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
