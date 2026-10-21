import { Routes, Route } from 'react-router-dom'
import Public from './pages/Public.jsx'
import Admin from './pages/Admin.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Public />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}
