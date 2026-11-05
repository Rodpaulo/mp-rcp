import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import CheckIn from './pages/CheckIn.jsx'
import Biblioteca from './pages/Biblioteca.jsx'

// O admin inteiro vem à parte (SPEC 17.6): o ficheiro da página pública só pode diminuir.
const Admin = lazy(() => import('./pages/Admin.jsx'))

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CheckIn />} />
      <Route path="/biblioteca" element={<Biblioteca />} />
      <Route
        path="/admin"
        element={
          <Suspense fallback={null}>
            <Admin />
          </Suspense>
        }
      />
      {/* Quem abre admin.html directamente fica no endereço canónico /admin (o manifesto do admin já veio no HTML). */}
      <Route path="/admin.html" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
