import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RiskProvider } from './context/RiskContext';
import { ComplianceProvider } from './context/ComplianceContext';
import { ProjectProvider } from './context/ProjectContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
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
import UsersPage from './pages/UsersPage';
import AuditLogsPage from './pages/AuditLogsPage';
import ProfilePage from './pages/ProfilePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

function AppProviders() {
  return (
    <RiskProvider>
      <ComplianceProvider>
        <ProjectProvider>
          <Outlet />
        </ProjectProvider>
      </ComplianceProvider>
    </RiskProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppProviders />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/risks" element={<RiskRegister />} />
                <Route path="/risks/:id" element={<RiskRegister />} />
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
                <Route path="/users" element={<UsersPage />} />
                <Route path="/audit-logs" element={<AuditLogsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
