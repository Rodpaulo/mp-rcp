import { Routes, Route, Navigate } from 'react-router-dom'
import CheckIn from './pages/CheckIn.jsx'
import Admin from './pages/Admin.jsx'
import Biblioteca from './pages/Biblioteca.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CheckIn />} />
      <Route path="/biblioteca" element={<Biblioteca />} />
      <Route path="/admin" element={<Admin />} />
      {/* Quem abre admin.html directamente fica no endereço canónico /admin (o manifesto do admin já veio no HTML). */}
      <Route path="/admin.html" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
