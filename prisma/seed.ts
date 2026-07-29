import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./grc.db' });
const prisma = new PrismaClient({ adapter });

console.log('Connecting:', process.env.DATABASE_URL);

function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }

async function main() {
  console.log('Seeding database...');

  // --- Risk Criteria ---
  const criteria = [
    { category: 'Information Security', categoryKey: 'infosec', subcategory: 'Access Control', subcategoryKey: 'access_control', criterion: 'Unauthorised access to critical systems', criterionKey: 'unauth_access', source: 'ISO 27001' },
    { category: 'Information Security', categoryKey: 'infosec', subcategory: 'Cryptography', subcategoryKey: 'crypto', criterion: 'Weak cryptographic controls', criterionKey: 'weak_crypto', source: 'ISO 27001' },
    { category: 'Information Security', categoryKey: 'infosec', subcategory: 'Operations', subcategoryKey: 'operations', criterion: 'Change management failure causing outage', criterionKey: 'change_mgmt_fail', source: 'ISO 27001' },
    { category: 'Business Continuity', categoryKey: 'bcm', subcategory: 'BCP', subcategoryKey: 'bcp', criterion: 'Critical system unavailable > RTO', criterionKey: 'system_unavailable', source: 'NBU №143' },
    { category: 'Business Continuity', categoryKey: 'bcm', subcategory: 'DRP', subcategoryKey: 'drp', criterion: 'Data loss exceeding RPO', criterionKey: 'data_loss', source: 'NBU №143' },
    { category: 'Data Protection', categoryKey: 'data_protection', subcategory: 'Privacy', subcategoryKey: 'privacy', criterion: 'Personal data breach', criterionKey: 'pd_breach', source: 'GDPR' },
    { category: 'Data Protection', categoryKey: 'data_protection', subcategory: 'DSAR', subcategoryKey: 'dsar', criterion: 'DSAR response time exceeds SLA', criterionKey: 'dsar_delay', source: 'GDPR' },
    { category: 'PCI DSS', categoryKey: 'pci', subcategory: 'CDE', subcategoryKey: 'cde', criterion: 'Insufficient CDE network segmentation', criterionKey: 'cde_segmentation', source: 'PCI DSS 4.0' },
    { category: 'PCI DSS', categoryKey: 'pci', subcategory: 'CHD', subcategoryKey: 'chd', criterion: 'Cardholder data exposure due to weak encryption', criterionKey: 'chd_exposure', source: 'PCI DSS 4.0' },
    { category: 'Third Party', categoryKey: 'tprm', subcategory: 'Vendor', subcategoryKey: 'vendor', criterion: 'Third-party security incident affecting operations', criterionKey: 'tp_incident', source: 'DORA' },
  ];
  for (const c of criteria) {
    await prisma.riskCriterion.create({ data: c });
  }

  // --- Controls ---
  const controls = [
    { title: 'A.5 Information Security Policies', description: 'Policy framework for information security management', framework: 'ISO 27001', category: 'Policies', status: 'implemented', owner: 'Ivan Petrenko', evidence: JSON.stringify(['IS_Policy_v3.pdf', 'Policy_Acceptance.xlsx']), evidenceLinks: JSON.stringify(['https://novapay-confluence/policy/is-policy']), attachments: JSON.stringify(['IS_Policy_v3.pdf']), controlDesign: 'NovaPay: Політика інформаційної безпеки затверджена наглядовою радою, розміщена в Confluence, щорічний перегляд', source: 'ISO 27001 A.5.1', accessList: JSON.stringify([{ email: 'i.petrenko@novapay.ua', role: 'owner', name: 'Ivan Petrenko', addedAt: '2025-01-01T10:00:00Z' }]), lastReviewed: '2026-06-01' },
    { title: 'A.6 Organization of Information Security', description: 'Internal organization, roles and responsibilities for IS', framework: 'ISO 27001', category: 'Organization', status: 'implemented', owner: 'Maria Koval', evidence: JSON.stringify(['RACI_Matrix.xlsx', 'Org_Chart.pdf']), evidenceLinks: JSON.stringify(['https://novapay-wiki/organization/security-roles']), attachments: JSON.stringify([]), controlDesign: 'NovaPay: Призначено CISO, створено комітет з інформаційної безпеки, розподілено ролі та відповідальність', source: 'ISO 27001 A.6.1', accessList: JSON.stringify([{ email: 'm.koval@novapay.ua', role: 'owner', name: 'Maria Koval', addedAt: '2025-02-01T10:00:00Z' }]), lastReviewed: '2026-05-15' },
    { title: 'A.7 Human Resource Security', description: 'Screening, onboarding, awareness and offboarding controls', framework: 'ISO 27001', category: 'HR', status: 'implemented', owner: 'Olena Shevchenko', evidence: JSON.stringify(['NDA_Template.docx', 'Training_Records.xlsx']), evidenceLinks: JSON.stringify(['https://novapay-hr/security/onboarding']), attachments: JSON.stringify([]), controlDesign: 'NovaPay: Впроваджено NDAs, перевірка фону, обов\'язкове навчання з ІБ при онбордингу, процедура звільнення', source: 'ISO 27001 A.7.1-A.7.3', accessList: JSON.stringify([{ email: 'o.shevchenko@novapay.ua', role: 'owner', name: 'Olena Shevchenko', addedAt: '2025-01-15T10:00:00Z' }]), lastReviewed: '2026-04-20' },
    { title: 'A.8 Asset Management', description: 'Inventory, classification, ownership and handling of assets', framework: 'ISO 27001', category: 'Asset Management', status: 'in_progress', owner: 'Dmytro Kovalenko', evidence: JSON.stringify(['Asset_Register.xlsx', 'Classification_Scheme.pdf']), evidenceLinks: JSON.stringify(['https://novapay-cmdb/assets']), attachments: JSON.stringify(['Asset_Register_v2.xlsx']), controlDesign: 'NovaPay: Впроваджено CMDB в ServiceNow, класифікація активів за конфіденційністю, цілісністю та доступністю', source: 'ISO 27001 A.8.1-A.8.3', accessList: JSON.stringify([{ email: 'd.kovalenko@novapay.ua', role: 'owner', name: 'Dmytro Kovalenko', addedAt: '2025-03-01T10:00:00Z' }]), lastReviewed: '2026-06-01' },
    { title: 'A.9 Access Control', description: 'Business requirements, user access management, responsibilities', framework: 'ISO 27001', category: 'Access Control', status: 'implemented', owner: 'Ivan Petrenko', evidence: JSON.stringify(['Access_Policy.pdf', 'Access_Review_Q2.xlsx']), evidenceLinks: JSON.stringify(['https://novapay-idm/access-policies']), attachments: JSON.stringify(['Access_Review_Q2.xlsx']), controlDesign: 'NovaPay: RBAC через Azure AD, щоквартальний перегляд доступу, MFA для всіх користувачів, JIT доступ для адмінів', source: 'ISO 27001 A.9.1-A.9.4', accessList: JSON.stringify([{ email: 'i.petrenko@novapay.ua', role: 'owner', name: 'Ivan Petrenko', addedAt: '2025-01-01T10:00:00Z' }]), lastReviewed: '2026-06-10' },
    { title: 'A.10 Cryptography', description: 'Cryptographic controls and key management', framework: 'ISO 27001', category: 'Cryptography', status: 'implemented', owner: 'Dmytro Kovalenko', evidence: JSON.stringify(['Crypto_Policy.pdf', 'Key_Management_Procedure.docx']), evidenceLinks: JSON.stringify(['https://novapay-wiki/security/cryptography']), attachments: JSON.stringify([]), controlDesign: 'NovaPay: TLS 1.3 для всіх сервісів, AES-256 для даних у спокої, HSM для ключів, ротація кожні 90 днів', source: 'ISO 27001 A.10.1', accessList: JSON.stringify([{ email: 'd.kovalenko@novapay.ua', role: 'owner', name: 'Dmytro Kovalenko', addedAt: '2025-02-01T10:00:00Z' }]), lastReviewed: '2026-05-01' },
    { title: 'Req 1: Install & Maintain Network Security Controls', description: 'Install and maintain network security controls to protect cardholder data', framework: 'PCI DSS 4.0', category: 'Network Security', status: 'implemented', owner: 'Dmytro Kovalenko', evidence: JSON.stringify(['FW_Rules_Audit.txt', 'Network_Diagram_CDE.pdf']), evidenceLinks: JSON.stringify(['https://novapay-netops/firewall-rules']), attachments: JSON.stringify(['Network_Diagram_CDE.pdf']), controlDesign: 'NovaPay: CDE сегмент ізольований, Next-Gen FW, WAF, IDS/PS, щоквартальний перегляд правил', source: 'PCI DSS 4.0 Req 1', accessList: JSON.stringify([{ email: 'd.kovalenko@novapay.ua', role: 'owner', name: 'Dmytro Kovalenko', addedAt: '2025-01-01T10:00:00Z' }]), lastReviewed: '2026-05-15' },
    { title: 'Req 2: Apply Secure Configurations', description: 'Apply secure configurations to all system components', framework: 'PCI DSS 4.0', category: 'Configuration Management', status: 'implemented', owner: 'Dmytro Kovalenko', evidence: JSON.stringify(['CIS_Baselines.pdf', 'Config_Scan_Report.pdf']), evidenceLinks: JSON.stringify(['https://novapay-cmdb/hardening']), attachments: JSON.stringify([]), controlDesign: 'NovaPay: CIS benchmarks для всіх систем, автоматизована перевірка конфігурацій, сканування щотижня', source: 'PCI DSS 4.0 Req 2', accessList: JSON.stringify([{ email: 'd.kovalenko@novapay.ua', role: 'owner', name: 'Dmytro Kovalenko', addedAt: '2025-01-15T10:00:00Z' }]), lastReviewed: '2026-06-01' },
    { title: 'Req 3: Protect Stored Account Data', description: 'Protect stored PAN, render it unreadable, retention policies', framework: 'PCI DSS 4.0', category: 'Data Protection', status: 'implemented', owner: 'Ivan Petrenko', evidence: JSON.stringify(['Encryption_Policy.pdf', 'Data_Retention_Schedule.xlsx']), evidenceLinks: JSON.stringify([]), attachments: JSON.stringify([]), controlDesign: 'NovaPay: PAN шифрується (AES-256), токенізація через vault, мінімізація зберігання, retention — 12 місяців', source: 'PCI DSS 4.0 Req 3', accessList: JSON.stringify([{ email: 'i.petrenko@novapay.ua', role: 'owner', name: 'Ivan Petrenko', addedAt: '2025-02-01T10:00:00Z' }]), lastReviewed: '2026-05-01' },
    { title: 'Req 4: Encrypt CHD in Transit', description: 'Strong cryptography for cardholder data transmission over open/public networks', framework: 'PCI DSS 4.0', category: 'Cryptography', status: 'implemented', owner: 'Dmytro Kovalenko', evidence: JSON.stringify(['TLS_Config.pdf', 'Certificate_Inventory.xlsx']), evidenceLinks: JSON.stringify(['https://novapay-netops/tls-compliance']), attachments: JSON.stringify([]), controlDesign: 'NovaPay: TLS 1.3 тільки, HSTS, certificate pinning, автоматичне оновлення сертифікатів через cert-manager', source: 'PCI DSS 4.0 Req 4', accessList: JSON.stringify([{ email: 'd.kovalenko@novapay.ua', role: 'owner', name: 'Dmytro Kovalenko', addedAt: '2025-02-01T10:00:00Z' }]), lastReviewed: '2026-06-01' },
    { title: 'Req 5: Protect Against Malware', description: 'Anti-malware protection for all systems, updated regularly', framework: 'PCI DSS 4.0', category: 'Endpoint Protection', status: 'implemented', owner: 'Dmytro Kovalenko', evidence: JSON.stringify(['AV_Deployment_Report.xlsx', 'Malware_Scan_Logs.pdf']), evidenceLinks: JSON.stringify(['https://novapay-edr/endpoints']), attachments: JSON.stringify([]), controlDesign: 'NovaPay: EDR (CrowdStrike) на всіх endpoints, щоденне оновлення сигнатур, щотижневе сканування', source: 'PCI DSS 4.0 Req 5', accessList: JSON.stringify([{ email: 'd.kovalenko@novapay.ua', role: 'owner', name: 'Dmytro Kovalenko', addedAt: '2025-01-01T10:00:00Z' }]), lastReviewed: '2026-05-20' },
  ];
  for (const c of controls) {
    await prisma.gRCControl.create({ data: c });
  }

  // --- Projects ---
  const projects = [
    {
      id: genId(), company: 'NovaPay LLC', title: 'ISO 27001:2026 Internal Audit', type: 'audit', framework: 'ISO 27001',
      status: 'execution', description: 'Annual internal audit of ISMS against ISO 27001:2022 standard',
      owner: 'Maria Koval', team: JSON.stringify(['Ivan Petrenko', 'Dmytro Kovalenko']),
      scope: JSON.stringify({ businessUnits: ['IT', 'Security', 'HR'], systems: ['NovaPay Core', 'SIEM', 'IDM'], assets: ['Servers', 'Databases', 'Endpoints'], frameworks: ['ISO 27001'], controls: ['A.5', 'A.6', 'A.7', 'A.8', 'A.9'], policies: ['IS Policy', 'Access Policy'], vendors: ['AWS', 'Cloudflare'] }),
      tasks: JSON.stringify([
        { id: genId(), title: 'Review A.5 Information Security Policies', description: 'Verify policy documents are current', status: 'completed', assignee: 'Ivan Petrenko', dueDate: '2026-07-15', evidence: ['IS_Policy_v3.pdf', 'Policy_Review_Report.pdf'], evidenceLinks: [], controlRef: 'A.5' },
        { id: genId(), title: 'Test A.9 Access Controls', description: 'Verify RBAC, MFA, and access reviews', status: 'in_progress', assignee: 'Dmytro Kovalenko', dueDate: '2026-07-30', evidence: ['Access_Review_Q2.xlsx'], evidenceLinks: ['https://novapay-idm/audit-log'], controlRef: 'A.9' },
      ]),
      reviews: JSON.stringify([]),
      findings: JSON.stringify([{ id: genId(), title: 'Outdated network diagram', severity: 'low', status: 'open', description: 'Network diagram does not reflect recent segmentation changes', remediation: 'Update network diagram and re-validate', controlRef: 'A.13' }]),
      startDate: '2026-07-01', targetDate: '2026-08-30', progress: 45,
    },
    {
      id: genId(), company: 'NovaPay LLC', title: 'PCI DSS 4.0 Implementation', type: 'implementation', framework: 'PCI DSS 4.0',
      status: 'execution', description: 'Implement required controls for PCI DSS 4.0 compliance',
      owner: 'Ivan Petrenko', team: JSON.stringify(['Dmytro Kovalenko', 'Andriy Bondar']),
      scope: JSON.stringify({ businessUnits: ['IT', 'Security'], systems: ['Payment Gateway', 'CDE'], assets: ['CDE Servers', 'Firewalls'], frameworks: ['PCI DSS 4.0'], controls: ['Req 1', 'Req 2', 'Req 3', 'Req 4', 'Req 7', 'Req 8', 'Req 10'], policies: ['PCI Policy', 'Encryption Policy'], vendors: ['Stripe', 'AWS'] }),
      tasks: JSON.stringify([
        { id: genId(), title: 'Implement Req 1: Network Segmentation', description: 'Isolate CDE from corporate network', status: 'completed', assignee: 'Dmytro Kovalenko', dueDate: '2026-06-30', evidence: ['Network_Diagram_CDE.pdf', 'FW_Rules_CDE.txt'], evidenceLinks: ['https://novapay-netops/cde-segment'], controlRef: 'Req 1' },
        { id: genId(), title: 'Implement Req 3: PAN Encryption', description: 'Encrypt stored PAN with AES-256', status: 'in_progress', assignee: 'Dmytro Kovalenko', dueDate: '2026-08-01', evidence: ['Encryption_Config.pdf'], evidenceLinks: [], controlRef: 'Req 3' },
      ]),
      reviews: JSON.stringify([]), findings: JSON.stringify([]),
      startDate: '2026-04-01', targetDate: '2026-12-01', progress: 35,
    },
    {
      id: genId(), company: 'Novapay Solutions', title: 'NBU Resolution №187 Compliance', type: 'nbu_check', framework: 'NBU Resolution №187',
      status: 'preparation', description: 'Ensure compliance with NBU Resolution №187 on cybersecurity',
      owner: 'Maria Koval', team: JSON.stringify(['Olena Shevchenko', 'Andriy Bondar']),
      scope: JSON.stringify({ businessUnits: ['IT', 'Security', 'Risk'], systems: ['All banking systems'], assets: ['Information assets'], frameworks: ['NBU Resolution №187'], controls: [], policies: [], vendors: [] }),
      tasks: JSON.stringify([
        { id: genId(), title: 'Gap Assessment against NBU №187', description: 'Identify gaps in current controls', status: 'open', assignee: 'Maria Koval', dueDate: '2026-08-01', evidence: [], evidenceLinks: [] },
      ]),
      reviews: JSON.stringify([]), findings: JSON.stringify([]),
      startDate: '2026-07-01', targetDate: '2026-10-01', progress: 15,
    },
    {
      id: genId(), company: 'NovaPay LLC', title: 'Annual Security Review 2026', type: 'annual_review', framework: 'ISO 27001',
      status: 'planning', description: 'Annual review of all security controls, policies, and risk posture',
      owner: 'Olena Shevchenko', team: JSON.stringify(['Ivan Petrenko', 'Maria Koval']),
      scope: JSON.stringify({ businessUnits: ['All'], systems: ['All'], assets: ['All'], frameworks: ['ISO 27001', 'NIST CSF'], controls: [], policies: ['All'], vendors: ['All'] }),
      tasks: JSON.stringify([
        { id: genId(), title: 'Schedule control testing calendar', description: 'Plan testing for all Annex A controls', status: 'open', assignee: 'Olena Shevchenko', dueDate: '2026-08-15', evidence: [], evidenceLinks: [] },
      ]),
      reviews: JSON.stringify([]), findings: JSON.stringify([]),
      startDate: '2026-08-01', targetDate: '2026-11-30', progress: 5,
    },
    {
      id: genId(), company: 'NovaPay EU UAB', title: 'DORA Readiness Assessment', type: 'gap_assessment', framework: 'DORA',
      status: 'scope', description: 'Gap assessment against EU Digital Operational Resilience Act requirements',
      owner: 'Andriy Bondar', team: JSON.stringify(['Maria Koval', 'Ivan Petrenko']),
      scope: JSON.stringify({ businessUnits: ['IT', 'Security', 'Risk'], systems: ['Core Banking', 'Payment Gateway'], assets: ['ICT Assets'], frameworks: ['DORA'], controls: [], policies: [], vendors: ['AWS', 'Cloudflare', 'Stripe'] }),
      tasks: JSON.stringify([
        { id: genId(), title: 'Map DORA requirements to existing controls', description: 'Cross-reference DORA articles with current control set', status: 'open', assignee: 'Maria Koval', dueDate: '2026-09-01', evidence: [], evidenceLinks: [] },
      ]),
      reviews: JSON.stringify([]), findings: JSON.stringify([]),
      startDate: '2026-07-15', targetDate: '2026-09-30', progress: 10,
    },
    {
      id: genId(), company: 'Novapay Solutions', title: 'SOC 2 Type II Remediation', type: 'remediation', framework: 'SOC 2',
      status: 'created', description: 'Remediate findings from SOC 2 Type II readiness assessment',
      owner: 'Dmytro Kovalenko', team: JSON.stringify(['Ivan Petrenko']),
      scope: JSON.stringify({ businessUnits: ['IT', 'Security'], systems: ['All Cloud Services'], assets: ['Cloud Infrastructure'], frameworks: ['SOC 2'], controls: ['CC6', 'CC7'], policies: ['Cloud Security Policy'], vendors: ['AWS', 'GCP'] }),
      tasks: JSON.stringify([]), reviews: JSON.stringify([]), findings: JSON.stringify([]),
      startDate: '2026-08-01', targetDate: '2026-10-31', progress: 0,
    },
    {
      id: genId(), company: 'Novapay Moldova', title: 'GDPR Compliance Campaign', type: 'compliance_campaign', framework: 'GDPR',
      status: 'created', description: 'GDPR compliance verification and documentation refresh',
      owner: 'Olena Shevchenko', team: JSON.stringify(['Maria Koval']),
      scope: JSON.stringify({ businessUnits: ['All'], systems: ['CRM', 'Marketing'], assets: ['Personal Data'], frameworks: ['GDPR'], controls: [], policies: ['Data Protection Policy', 'Privacy Policy'], vendors: [] }),
      tasks: JSON.stringify([
        { id: genId(), title: 'Update RoPA (Register of Processing)', description: 'Review and update data processing register', status: 'open', assignee: 'Olena Shevchenko', dueDate: '2026-09-01', evidence: [], evidenceLinks: [] },
      ]),
      reviews: JSON.stringify([]), findings: JSON.stringify([]),
      startDate: '2026-08-15', targetDate: '2026-11-01', progress: 0,
    },
  ];
  for (const p of projects) {
    await prisma.project.create({ data: { ...p, createdAt: new Date(), updatedAt: new Date() } });
  }

  // --- Documents ---
  const docs = [
    { title: 'Information Security Policy v2.3', type: 'policy', framework: 'ISO 27001', status: 'active', files: JSON.stringify([{ name: 'IS_Policy_v2.3.pdf', size: 245760, type: 'application/pdf' }]), links: JSON.stringify(['https://novapay-confluence/policy/is-policy']) },
    { title: 'Risk Assessment Report 2026', type: 'report', framework: 'ISO 27001', status: 'active', files: JSON.stringify([{ name: 'Risk_Assessment_2026.pdf', size: 524288, type: 'application/pdf' }]), links: JSON.stringify([]) },
    { title: 'SOC 2 Type II Report', type: 'certificate', framework: 'SOC 2', status: 'active', files: JSON.stringify([{ name: 'SOC2_Report_2025.pdf', size: 1048576, type: 'application/pdf' }]), links: JSON.stringify([]) },
    { title: 'BCP Test Results Q2', type: 'evidence', framework: 'NBU Resolution №143', status: 'active', files: JSON.stringify([]), links: JSON.stringify(['https://novapay-bcm/test-results-q2']) },
    { title: 'Data Processing Register', type: 'procedure', framework: 'GDPR', status: 'active', files: JSON.stringify([{ name: 'RoPA_v2.xlsx', size: 102400, type: 'application/xlsx' }]), links: JSON.stringify(['https://novapay-privacy/ropa']) },
    { title: 'Penetration Test Report Q1 2026', type: 'report', framework: 'PCI DSS', status: 'active', files: JSON.stringify([{ name: 'PT_Report_Q1_2026.pdf', size: 2097152, type: 'application/pdf' }]), links: JSON.stringify([]) },
    { title: 'ISO 27001 Certificate', type: 'certificate', framework: 'ISO 27001', status: 'active', files: JSON.stringify([{ name: 'ISO27001_Cert.pdf', size: 512000, type: 'application/pdf' }]), links: JSON.stringify([]) },
    { title: 'Incident Response Playbooks', type: 'procedure', framework: 'NIST CSF', status: 'active', files: JSON.stringify([{ name: 'IR_Playbooks_v2.docx', size: 307200, type: 'application/docx' }]), links: JSON.stringify(['https://novapay-siem/playbooks']) },
  ];
  for (const d of docs) {
    await prisma.gRCDocument.create({ data: { ...d, uploadedAt: new Date(), updatedAt: new Date() } });
  }

  // --- Policies ---
  const policies = [
    { title: 'Information Security Policy', version: '2.3', status: 'published', framework: 'ISO 27001', owner: 'Ivan Petrenko', description: 'Overall ISMS policy', lastReviewed: '2026-05-01' },
    { title: 'Data Protection Policy', version: '1.2', status: 'published', framework: 'GDPR', owner: 'Olena Shevchenko', description: 'Personal data processing and protection', lastReviewed: '2026-04-15' },
    { title: 'Incident Response Policy', version: '0.9', status: 'in_review', framework: 'NIST CSF', owner: 'Maria Koval', description: 'Incident handling and escalation', lastReviewed: '2026-06-10' },
    { title: 'Third-Party Risk Policy', version: '0.5', status: 'draft', framework: 'DORA', owner: 'Andriy Bondar', description: 'Vendor risk management framework', lastReviewed: '2026-06-01' },
  ];
  for (const p of policies) {
    await prisma.policy.create({ data: { ...p, createdAt: new Date(), updatedAt: new Date() } });
  }

  // --- Tasks ---
  const tasks = [
    { title: 'Complete ISO 27001 gap analysis', description: 'Analyse current state vs. standard', status: 'completed', priority: 'high', framework: 'ISO 27001', category: 'Assessment', assignee: 'Maria Koval', dueDate: '2026-05-01' },
    { title: 'Update Access Control Matrix', description: 'Review and update RBAC policies', status: 'in_progress', priority: 'high', framework: 'ISO 27001', category: 'Access Control', assignee: 'Ivan Petrenko', dueDate: '2026-07-15' },
    { title: 'Run ASV Scan Q3', description: 'Quarterly external vulnerability scan', status: 'remaining', priority: 'critical', framework: 'PCI DSS', category: 'Security Testing', assignee: 'Dmytro Kovalenko', dueDate: '2026-08-01' },
    { title: 'Prepare BCP Test Plan', description: 'Design test scenarios for business continuity', status: 'remaining', priority: 'medium', framework: 'NBU Resolution №143', category: 'BCM', assignee: 'Andriy Bondar', dueDate: '2026-08-15' },
    { title: 'Renew SSL certificates', description: 'Update expiring certificates', status: 'due_soon', priority: 'high', framework: 'PCI DSS', category: 'Cryptography', assignee: 'Dmytro Kovalenko', dueDate: '2026-07-20' },
  ];
  for (const t of tasks) {
    await prisma.gRCTask.create({ data: { ...t, createdAt: new Date(), updatedAt: new Date() } });
  }

  // --- Automated Checks ---
  const checks = [
    { name: 'MFA enabled on all admin accounts', status: 'passed', framework: 'ISO 27001', lastRun: new Date('2026-07-02T06:00:00Z'), details: 'All 24 admin accounts have MFA enabled' },
    { name: 'S3 bucket public access blocked', status: 'passed', framework: 'SOC 2', lastRun: new Date('2026-07-02T06:00:00Z'), details: 'All 156 S3 buckets are properly restricted' },
    { name: 'Encryption at rest - RDS', status: 'passed', framework: 'PCI DSS', lastRun: new Date('2026-07-02T06:00:00Z'), details: 'All 12 RDS instances encrypted' },
    { name: 'SSL/TLS certificate expiry', status: 'failed', framework: 'NIST CSF', lastRun: new Date('2026-07-02T06:00:00Z'), details: '3 certs expiring within 30 days' },
    { name: 'Unpatched critical CVEs', status: 'failed', framework: 'ISO 27001', lastRun: new Date('2026-07-02T06:00:00Z'), details: '15 critical vulns unpatched in production' },
    { name: 'CloudTrail enabled in all regions', status: 'failed', framework: 'PCI DSS', lastRun: new Date('2026-07-02T06:00:00Z'), details: '2 regions missing CloudTrail logging' },
    { name: 'Anti-malware endpoint coverage', status: 'passed', framework: 'ISO 27001', lastRun: new Date('2026-07-02T06:00:00Z'), details: '98% of endpoints have active anti-malware' },
    { name: 'Access review - privileged accounts', status: 'failed', framework: 'NIST CSF', lastRun: new Date('2026-07-01T06:00:00Z'), details: '8 privileged accounts not reviewed in 90 days' },
    { name: 'WAF ruleset update', status: 'error', framework: 'PCI DSS', lastRun: new Date('2026-07-01T06:00:00Z'), details: 'WAF agent unreachable — check failed' },
  ];
  for (const c of checks) {
    await prisma.automatedCheck.create({ data: c });
  }

  // --- Integrations ---
  const integrations = [
    { name: 'AWS Cloud', type: 'Cloud', connectorType: 'aws', status: 'connected', config: JSON.stringify({ awsAccessKeyId: 'AKIA****WXYZ', awsRegion: 'eu-west-1', awsRoleArn: 'arn:aws:iam::123456789012:role/grc-scanner' }), lastSync: '2026-07-02T06:00:00Z', version: '1.0.0' },
    { name: 'GitHub Enterprise', type: 'Source Control', connectorType: 'github', status: 'connected', config: JSON.stringify({ githubOrganization: 'novapay', githubToken: 'ghp_****abcd' }), lastSync: '2026-07-02T06:00:00Z', version: '2.1.0' },
    { name: 'GitLab Self-Hosted', type: 'Source Control', connectorType: 'gitlab', status: 'disconnected', config: JSON.stringify({ gitlabUrl: 'https://gitlab.novapay.ua', gitlabProjectId: '42' }), lastSync: '2026-06-15T10:00:00Z', lastError: 'Token expired', version: '1.2.0' },
  ];
  for (const i of integrations) {
    await prisma.integration.create({ data: i });
  }

  // --- Risk Items ---
  for (let i = 1; i <= 10; i++) {
    await prisma.riskItem.create({
      data: {
        criterionId: i,
        status: i <= 5 ? 'assessing' : 'identified',
        inherentLikelihood: Math.floor(Math.random() * 3) + 2,
        inherentImpact: Math.floor(Math.random() * 3) + 2,
        residualLikelihood: Math.floor(Math.random() * 2) + 1,
        residualImpact: Math.floor(Math.random() * 2) + 1,
        owner: ['Ivan Petrenko', 'Maria Koval', 'Dmytro Kovalenko', 'Olena Shevchenko', 'Andriy Bondar'][i % 5],
        treatmentPlan: i % 3 === 0 ? 'Implement compensating controls' : '',
        notes: '',
      },
    });
  }

  console.log('Database seeded successfully!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
