import { Routes, Route } from 'react-router-dom'
import CheckIn from './pages/CheckIn.jsx'
import Admin from './pages/Admin.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CheckIn />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}
