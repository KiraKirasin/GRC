import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RiskProvider } from './context/RiskContext';
import { ComplianceProvider } from './context/ComplianceContext';
import { ProjectProvider } from './context/ProjectContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import RiskRegister from './pages/RiskRegister';

import TasksPage from './pages/TasksPage';
import ControlsPage from './pages/ControlsPage';
import ControlsDatabasePage from './pages/ControlsDatabasePage';
import PoliciesPage from './pages/PoliciesPage';
import DocumentsPage from './pages/DocumentsPage';
import RoadmapPage from './pages/RoadmapPage';
import IntegrationsPage from './pages/IntegrationsPage';
import CopilotPage from './pages/CopilotPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <RiskProvider>
        <ComplianceProvider>
          <ProjectProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/risks" element={<RiskRegister />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/controls" element={<ControlsPage />} />
              <Route path="/evidence-database" element={<ControlsDatabasePage />} />
              <Route path="/policies" element={<PoliciesPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/roadmap" element={<RoadmapPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/copilot" element={<CopilotPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
            </Route>
          </Routes>
          </ProjectProvider>
        </ComplianceProvider>
      </RiskProvider>
    </BrowserRouter>
  );
}
