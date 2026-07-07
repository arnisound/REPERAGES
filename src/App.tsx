import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import ProjectsPage from './pages/ProjectsPage'
import ProjectLayout from './pages/ProjectLayout'
import ProjectInfoPage from './pages/ProjectInfoPage'
import PointDetailPage from './pages/PointDetailPage'
import PlansListPage from './pages/PlansListPage'

const MapPage = lazy(() => import('./pages/map/MapPage'))
const PlanEditorPage = lazy(() => import('./pages/plan/PlanEditorPage'))
const SitePlanPage = lazy(() => import('./pages/siteplan/SitePlanPage'))

function App() {
  return (
    <Suspense fallback={<div className="empty-state">Chargement…</div>}>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectLayout />}>
          <Route index element={<ProjectInfoPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="points/:pointId" element={<PointDetailPage />} />
          <Route path="plans" element={<PlansListPage />} />
        </Route>
        <Route path="/projects/:projectId/plans/:planId" element={<PlanEditorPage />} />
        <Route path="/projects/:projectId/site-plan" element={<SitePlanPage />} />
      </Routes>
    </Suspense>
  )
}

export default App
