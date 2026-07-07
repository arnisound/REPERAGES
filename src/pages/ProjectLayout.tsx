import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardList, Info, Map, LayoutGrid } from 'lucide-react'
import { db } from '../db/db'

export default function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const project = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId])

  useEffect(() => {
    if (project === null) navigate('/', { replace: true })
  }, [project, navigate])

  return (
    <div className="app-shell">
      <div className="app-main">
        <Outlet />
      </div>
      <nav className="app-nav">
        <NavLink to={`/projects/${projectId}/map`} className={({ isActive }) => (isActive ? 'active' : '')}>
          <Map size={20} />
          <span>Carte</span>
        </NavLink>
        <NavLink to={`/projects/${projectId}/plans`} className={({ isActive }) => (isActive ? 'active' : '')}>
          <LayoutGrid size={20} />
          <span>Plans</span>
        </NavLink>
        <NavLink to={`/projects/${projectId}/materiel`} className={({ isActive }) => (isActive ? 'active' : '')}>
          <ClipboardList size={20} />
          <span>Matériel</span>
        </NavLink>
        <NavLink to={`/projects/${projectId}`} end className={({ isActive }) => (isActive ? 'active' : '')}>
          <Info size={20} />
          <span>Infos</span>
        </NavLink>
      </nav>
    </div>
  )
}
