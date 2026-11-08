// src/pages/Dashboard.jsx
//
// This is the Personal Dashboard page.
// For now it shows a "coming soon" shell so the app renders correctly.
// We will fill in the full dashboard content in the next stage.

import { GraduationCap } from 'lucide-react'

function Dashboard() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F8FC] dark:bg-[#171A29] p-6">
      <div className="text-center max-w-md">
        {/* Logo / Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#A9C9FF] mb-6">
          <GraduationCap size={32} className="text-white" />
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-[#242B3A] dark:text-[#F1F1FC] mb-2"
            style={{ fontFamily: 'Poppins, sans-serif' }}>
          CampusMate
        </h1>
        <p className="text-[#737B8C] dark:text-[#A0A8B8] text-base mb-8">
          Your all-in-one college companion
        </p>

        {/* Status card */}
        <div className="card text-left">
          <p className="text-sm font-semibold text-[#A9C9FF] mb-1 uppercase tracking-wider">
            Stage 1 Complete ✅
          </p>
          <p className="text-[#242B3A] dark:text-[#F1F1FC] font-medium mb-1">
            Project initialized successfully
          </p>
          <p className="text-sm text-[#737B8C] dark:text-[#A0A8B8]">
            React + Vite + Tailwind CSS v4 + React Router + Supabase client are all set up.
            The Dashboard, layout and navigation will be built in the next stage.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
