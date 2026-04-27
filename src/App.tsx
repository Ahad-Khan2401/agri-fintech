import { Outlet } from 'react-router-dom'
import Header from './components/layout/Header'

export default function App() {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}