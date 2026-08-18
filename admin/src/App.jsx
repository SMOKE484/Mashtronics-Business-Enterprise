import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Technicians from './pages/Technicians'
import ResponseOfficers from './pages/ResponseOfficers'
import Quotes from './pages/Quotes'
import QuoteBuilder from './pages/QuoteBuilder'
import Jobs from './pages/Jobs'
import Invoicing from './pages/Invoicing'
import Scheduling from './pages/Scheduling'
import Maintenance from './pages/Maintenance'
import Compliance from './pages/Compliance'
import ClientFiles from './pages/ClientFiles'
import ChatQuestions from './pages/ChatQuestions'
import Messages from './pages/Messages'
import DeviceBinds from './pages/DeviceBinds'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="technicians" element={<Technicians />} />
        <Route path="response-officers" element={<ResponseOfficers />} />
        <Route path="quotes" element={<Quotes />} />
        <Route path="quotes/new" element={<QuoteBuilder />} />
        <Route path="quotes/:id/edit" element={<QuoteBuilder />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="invoicing" element={<Invoicing />} />
        <Route path="scheduling" element={<Scheduling />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="compliance" element={<Compliance />} />
        <Route path="client-files" element={<ClientFiles />} />
        <Route path="chat-questions" element={<ChatQuestions />} />
        <Route path="messages" element={<Messages />} />
        <Route path="device-binds" element={<DeviceBinds />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
