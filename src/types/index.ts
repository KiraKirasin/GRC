// --- Risk Management ---

export interface RiskCriterion {
  id: number;
  category: string;
  categoryKey: string;
  subcategory: string;
  subcategoryKey: string;
  criterion: string;
  criterionKey: string;
  source: string;
}

export interface RiskItem {
  id: string;
  criterionId: number;
  status: RiskStatus;
  inherentLikelihood: number;
  inherentImpact: number;
  residualLikelihood: number;
  residualImpact: number;
  owner: string;
  treatmentPlan: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type RiskStatus = 'identified' | 'assessing' | 'mitigating' | 'accepted' | 'monitoring';

// --- Tasks ---

export interface GRCTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  framework: string;
  category: string;
  assignee: string;
  dueDate: string;
  /** Links mitigation action from a project control */
  sourceProjectId?: string;
  sourceControlId?: string;
  sourceControlCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'completed' | 'in_progress' | 'remaining' | 'due_soon' | 'overdue';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

// --- Controls ---

export interface ControlAccess {
  email: string;
  role: 'owner' | 'manager' | 'implementer' | 'reviewer' | 'viewer' | 'approver';
  name: string;
  addedAt: string;
}

export interface GRCControl {
  id: string;
  controlCode?: string;
  title: string;
  description: string;
  framework: string;
  category: string;
  status: ControlStatus;
  owner: string;
  evidence: string[];
  evidenceLinks: string[];
  attachments: string[];
  controlDesign: string;
  source: string;
  accessList: ControlAccess[];
  lastReviewed: string;
  createdAt: string;
  updatedAt: string;
} 

export type ControlStatus = 'implemented' | 'in_progress' | 'pending' | 'not_applicable';

export const CONTROL_FRAMEWORKS = [
  { name: 'NBU Resolution №95', shortName: 'НБУ №95', color: 'bg-brand-500' },
  { name: 'NBU Resolution №187', shortName: 'НБУ №187', color: 'bg-violet-500' },
  { name: 'NBU Resolution №143', shortName: 'НБУ №143', color: 'bg-blue-500' },
  { name: 'PCI DSS 4.0', shortName: 'PCI DSS', color: 'bg-pink-500' },
  { name: 'ISO 27001', shortName: 'ISO 27001', color: 'bg-emerald-500' },
  { name: 'Enterprise Control Library', shortName: 'ECL', color: 'bg-indigo-500' },
  { name: 'GDPR', shortName: 'GDPR', color: 'bg-orange-500' },
];

// --- Policies ---

export interface Policy {
  id: string;
  title: string;
  version: string;
  status: PolicyStatus;
  framework: string;
  owner: string;
  description: string;
  lastReviewed: string;
  createdAt: string;
  updatedAt: string;
}

export type PolicyStatus = 'published' | 'in_review' | 'draft' | 'archived';

// --- Documents ---

export interface GRCDocumentFile {
  name: string;
  size: number;
  type: string;
}

export interface GRCDocument {
  id: string;
  title: string;
  type: DocumentType;
  framework: string;
  status: 'active' | 'archived';
  files: GRCDocumentFile[];
  links: string[];
  uploadedAt: string;
  updatedAt: string;
}

export type DocumentType = 'procedure' | 'standard' | 'evidence' | 'report' | 'certificate' | 'policy' | 'other';

// --- Framework Progress ---

export interface FrameworkProgress {
  name: string;
  total: number;
  completed: number;
  color: string;
}

// --- Automated Checks ---

export interface AutomatedCheck {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'error';
  framework: string;
  lastRun: string;
  details: string;
}

// --- Roadmap Milestones ---

export interface Milestone {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed';
  framework: string;
  progress: number;
}

// --- Integration ---

export interface ConnectorConfig {
  // AWS
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  awsRoleArn?: string;
  // GitHub
  githubToken?: string;
  githubOrganization?: string;
  githubRepository?: string;
  // GitLab
  gitlabToken?: string;
  gitlabUrl?: string;
  gitlabProjectId?: string;
  // MS 365
  m365TenantId?: string;
  m365ClientId?: string;
  m365ClientSecret?: string;
  // Azure
  azureTenantId?: string;
  azureSubscriptionId?: string;
  azureClientId?: string;
  azureClientSecret?: string;
  // Jira
  jiraUrl?: string;
  jiraUsername?: string;
  jiraApiToken?: string;
  jiraProject?: string;
  // Google Spaces / Google Workspace
  googleSpacesServiceAccount?: string;
  googleSpacesDomain?: string;
  // GCP
  gcpProjectId?: string;
  gcpServiceAccountKey?: string;
  gcpRegion?: string;
}

export type ConnectorType =
  | 'aws'
  | 'github'
  | 'gitlab'
  | 'm365'
  | 'azure'
  | 'jira'
  | 'google_spaces'
  | 'gcp';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'configuring';

export interface Integration {
  id: string;
  name: string;
  type: string;
  connectorType: ConnectorType;
  status: IntegrationStatus;
  config: ConnectorConfig;
  lastSync: string;
  lastError?: string;
  version?: string;
}

// --- CISO Copilot ---

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// --- Project / Engagement ---

export type ProjectType =
  | 'audit'
  | 'implementation'
  | 'annual_review'
  | 'gap_assessment'
  | 'certification'
  | 'nbu_check'
  | 'compliance_campaign'
  | 'remediation'
  | 'incident_post_review'
  | 'third_party_assessment'
  | 're_certification';

export type ProjectStatus =
  | 'created'
  | 'planning'
  | 'scope'
  | 'preparation'
  | 'execution'
  | 'review'
  | 'approval'
  | 'closure'
  | 'lessons_learned';

export interface ProjectScope {
  businessUnits: string[];
  systems: string[];
  assets: string[];
  frameworks: string[];
  controls: string[];
  policies: string[];
  vendors: string[];
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed' | 'blocked';
  assignee: string;
  dueDate: string;
  evidence: string[];
  evidenceLinks: string[];
  controlRef?: string;
  completedAt?: string;
}

export interface ProjectReview {
  id: string;
  stage: 'security' | 'compliance' | 'internal_audit' | 'ciso' | 'management';
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  reviewer: string;
  comments: string;
  reviewedAt: string;
}

export interface ProjectFinding {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'accepted';
  description: string;
  remediation: string;
  controlRef?: string;
}

export type CompanyName = 'NovaPay LLC' | 'Novapay Solutions' | 'Novapay Moldova' | 'NovaPay EU UAB';

export const COMPANIES: CompanyName[] = [
  'NovaPay LLC',
  'Novapay Solutions',
  'Novapay Moldova',
  'NovaPay EU UAB',
];

export interface Project {
  id: string;
  title: string;
  company: CompanyName;
  type: ProjectType;
  framework: string;
  status: ProjectStatus;
  description: string;
  owner: string;
  team: string[];
  scope: ProjectScope;
  tasks: ProjectTask[];
  reviews: ProjectReview[];
  findings: ProjectFinding[];
  startDate: string;
  targetDate: string;
  completedAt?: string;
  progress: number;
  controlCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** Project-scoped control snapshot (does not mutate Controls Repository) */
export interface ControlAttachment {
  id: string;
  name: string;
  storedName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export interface ControlMitigation {
  enabled: boolean;
  title: string;
  description: string;
  category: string;
  assignee: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  taskId?: string;
}

export const EMPTY_MITIGATION: ControlMitigation = {
  enabled: false,
  title: '',
  description: '',
  category: '',
  assignee: '',
  dueDate: '',
  priority: 'medium',
  status: 'remaining',
};

export interface ProjectControl {
  id: string;
  projectId: string;
  sourceControlId: string;
  controlCode: string;
  title: string;
  description: string;
  framework: string;
  category: string;
  status: ControlStatus;
  owner: string;
  evidence: string[];
  evidenceLinks: string[];
  attachments: ControlAttachment[];
  controlDesign: string;
  source: string;
  accessList: ControlAccess[];
  lastReviewed: string;
  mitigation: ControlMitigation;
  createdAt: string;
  updatedAt: string;
}

export const PROJECT_TYPES: { type: ProjectType; label: string; icon: string }[] = [
  { type: 'audit', label: '🔍', icon: '🔍' },
  { type: 'implementation', label: '🛡️', icon: '🛡️' },
  { type: 'annual_review', label: '🔄', icon: '🔄' },
  { type: 'gap_assessment', label: '📋', icon: '📋' },
  { type: 'certification', label: '📑', icon: '📑' },
  { type: 'nbu_check', label: '🏦', icon: '🏦' },
  { type: 'compliance_campaign', label: '📜', icon: '📜' },
  { type: 'remediation', label: '⚠️', icon: '⚠️' },
  { type: 'incident_post_review', label: '🚨', icon: '🚨' },
  { type: 'third_party_assessment', label: '🏢', icon: '🏢' },
  { type: 're_certification', label: '🔄', icon: '🔄' },
];

export const PROJECT_STATUSES: { status: ProjectStatus; label: string; color: string }[] = [
  { status: 'created', label: 'Створено', color: 'bg-gray-100 text-gray-700' },
  { status: 'planning', label: 'Планування', color: 'bg-blue-100 text-blue-700' },
  { status: 'scope', label: 'Scope', color: 'bg-brand-200 text-brand-700' },
  { status: 'preparation', label: 'Підготовка', color: 'bg-purple-100 text-purple-700' },
  { status: 'execution', label: 'Виконання', color: 'bg-amber-100 text-amber-700' },
  { status: 'review', label: 'Review', color: 'bg-orange-100 text-orange-700' },
  { status: 'approval', label: 'Затвердження', color: 'bg-pink-100 text-pink-700' },
  { status: 'closure', label: 'Закриття', color: 'bg-emerald-100 text-emerald-700' },
  { status: 'lessons_learned', label: 'Lessons Learned', color: 'bg-teal-100 text-teal-700' },
];

// --- Shared utilities ---

export const RISK_LEVELS = [
  { min: 1, max: 3, label: 'low', color: 'bg-green-100 text-green-800', key: 'low' },
  { min: 4, max: 6, label: 'medium', color: 'bg-yellow-100 text-yellow-800', key: 'medium' },
  { min: 7, max: 12, label: 'high', color: 'bg-orange-100 text-orange-800', key: 'high' },
  { min: 13, max: 25, label: 'critical', color: 'bg-red-100 text-red-800', key: 'critical' },
];

export function calculateRiskLevel(likelihood: number, impact: number): number {
  return likelihood * impact;
}

export function getRiskLevelLabel(score: number): string {
  for (const l of RISK_LEVELS) {
    if (score >= l.min && score <= l.max) return l.key;
  }
  return 'unknown';
}

export function getRiskLevelColor(score: number): string {
  for (const l of RISK_LEVELS) {
    if (score >= l.min && score <= l.max) return l.color;
  }
  return 'bg-gray-100 text-gray-800';
}

export const FRAMEWORKS = [
  { name: 'Enterprise Control Library', shortName: 'ECL', color: 'bg-indigo-500' },
  { name: 'NBU Resolution №95', shortName: 'НБУ №95', color: 'bg-brand-500' },
  { name: 'NBU Resolution №187', shortName: 'НБУ №187', color: 'bg-violet-500' },
  { name: 'NBU Resolution №143', shortName: 'НБУ №143', color: 'bg-blue-500' },
  { name: 'PCI DSS 4.0', shortName: 'PCI DSS', color: 'bg-pink-500' },
  { name: 'ISO 27001', shortName: 'ISO 27001', color: 'bg-emerald-500' },
  { name: 'SOC 2', shortName: 'SOC 2', color: 'bg-purple-500' },
  { name: 'HIPAA', shortName: 'HIPAA', color: 'bg-red-500' },
  { name: 'GDPR', shortName: 'GDPR', color: 'bg-orange-500' },
  { name: 'NIST CSF', shortName: 'NIST CSF', color: 'bg-teal-500' },
];

/** Resolve short label for a framework name from known catalogs. */
export function frameworkShortName(name: string): string {
  const known = CONTROL_FRAMEWORKS.find(f => f.name === name) || FRAMEWORKS.find(f => f.name === name);
  return known?.shortName || name;
}

/** Unique frameworks present in controls, preferred order first. */
export function frameworksFromControls(controls: { framework: string }[]): { name: string; shortName: string }[] {
  const present = new Set(controls.map(c => c.framework).filter(Boolean));
  const preferred = [...CONTROL_FRAMEWORKS, ...FRAMEWORKS]
    .filter((f, i, arr) => present.has(f.name) && arr.findIndex(x => x.name === f.name) === i)
    .map(f => ({ name: f.name, shortName: f.shortName }));
  const preferredNames = new Set(preferred.map(f => f.name));
  const rest = [...present]
    .filter(name => !preferredNames.has(name))
    .sort()
    .map(name => ({ name, shortName: frameworkShortName(name) }));
  return [...preferred, ...rest];
}

/** PCI DSS 4.0 domain order as requirements appear in the standard (Req 1 → 12). */
export const PCI_DSS_DOMAIN_ORDER = [
  'Network Security',           // Req 1
  'Configuration Management',   // Req 2
  'Data Protection',            // Req 3
  'Cryptography',               // Req 3–4
  'Endpoint Protection',        // Req 5
  'Secure SDLC',                // Req 6
  'Vulnerability Management',   // Req 6.3
  'Application Security',       // Req 6.4
  'Change Management',          // Req 6.5
  'Access Control',             // Req 7
  'Authentication',             // Req 8
  'Physical Security',          // Req 9
  'Logging & Monitoring',       // Req 10
  'Security Testing',           // Req 11
  'Governance & Policies',      // Req 12
  'Risk Management',            // Req 12
  'Compliance',                 // Req 12
  'Awareness',                  // Req 12
  'HR Security',                // Req 12
  'Third-Party Risk',           // Req 12
  'Incident Response',          // Req 12
] as const;

/** ISO 27001 thematic domain order (bilingual EN / UK as stored in category). */
export const ISO27001_DOMAIN_ORDER = [
  'Information security policies / Політики інформаційної безпеки',
  'Organization of information security / Організація інформаційної безпеки',
  'Human resource security / Безпека людських ресурсів',
  'Asset management / Управління активами',
  'Access control / Контроль доступу',
  'Cryptography / Кріптографія',
  'Physical security and environmental security / Фізична безпека та безпека довкілля',
  'Operations security / Операційна безпека',
  'Communications security / Безпека комунікацій',
  'System acquisition, development and maintenance / Придбання, розробка та обслуговування систем',
  'Supplier relationships / Відносини з постачальниками',
  'Information security incident management / Управління інцидентами інформаційної безпеки',
  'Information security aspects of business continuity management / Аспекти управління безперервністю бізнесу',
  'Compliance / Відповідність вимогам (комплаєнс)',
] as const;

export function compareControlCodes(a = '', b = ''): number {
  const parse = (s: string) =>
    s
      .replace(/^PCI-/i, '')
      .split(/[.\-]/)
      .map(part => {
        const n = Number(part);
        return Number.isFinite(n) ? n : part.toLowerCase();
      });
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x - y;
    } else {
      const cmp = String(x).localeCompare(String(y), undefined, { numeric: true });
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

export function compareDomainsByStandard(a: string, b: string): number {
  if (a === '__uncategorized__') return 1;
  if (b === '__uncategorized__') return -1;
  const ia = PCI_DSS_DOMAIN_ORDER.indexOf(a as (typeof PCI_DSS_DOMAIN_ORDER)[number]);
  const ib = PCI_DSS_DOMAIN_ORDER.indexOf(b as (typeof PCI_DSS_DOMAIN_ORDER)[number]);
  if (ia !== -1 || ib !== -1) {
    return (ia === -1 ? 1000 : ia) - (ib === -1 ? 1000 : ib);
  }
  const iIsoA = ISO27001_DOMAIN_ORDER.indexOf(a as (typeof ISO27001_DOMAIN_ORDER)[number]);
  const iIsoB = ISO27001_DOMAIN_ORDER.indexOf(b as (typeof ISO27001_DOMAIN_ORDER)[number]);
  if (iIsoA !== -1 || iIsoB !== -1) {
    return (iIsoA === -1 ? 1000 : iIsoA) - (iIsoB === -1 ? 1000 : iIsoB);
  }
  return a.localeCompare(b);
}

