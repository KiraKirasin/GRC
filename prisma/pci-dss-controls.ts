/**
 * PCI DSS v4.0.1 control catalog for Controls Repository.
 * Covers Requirements 1–12 with principal sub-requirements.
 */
export type PciControlSeed = {
  controlCode: string;
  title: string;
  description: string;
  category: string;
  source: string;
};

export const PCI_DSS_CONTROLS: PciControlSeed[] = [
  // Req 1
  { controlCode: 'PCI-1', title: 'Install and Maintain Network Security Controls', description: 'Network security controls (NSCs) are installed and maintained to protect the cardholder data environment (CDE).', category: 'Network Security', source: 'PCI DSS 4.0 Req 1' },
  { controlCode: 'PCI-1.1', title: 'NSC Processes Defined and Understood', description: 'Processes and mechanisms for installing and maintaining network security controls are defined and understood.', category: 'Network Security', source: 'PCI DSS 4.0 Req 1.1' },
  { controlCode: 'PCI-1.2', title: 'Network Security Controls Configured and Maintained', description: 'Network security controls (NSCs) are configured and maintained.', category: 'Network Security', source: 'PCI DSS 4.0 Req 1.2' },
  { controlCode: 'PCI-1.3', title: 'Network Access to and from CDE Restricted', description: 'Network access to and from the CDE is restricted.', category: 'Network Security', source: 'PCI DSS 4.0 Req 1.3' },
  { controlCode: 'PCI-1.4', title: 'Network Connections Between Trusted and Untrusted Networks Controlled', description: 'Network connections between trusted and untrusted networks are controlled.', category: 'Network Security', source: 'PCI DSS 4.0 Req 1.4' },
  { controlCode: 'PCI-1.5', title: 'Risks from Computing Devices Capable of Connecting to Both CDE and Untrusted Networks', description: 'Risks to the CDE from computing devices that can connect to both untrusted networks and the CDE are mitigated.', category: 'Network Security', source: 'PCI DSS 4.0 Req 1.5' },

  // Req 2
  { controlCode: 'PCI-2', title: 'Apply Secure Configurations to All System Components', description: 'Secure configurations are applied to all system components.', category: 'Configuration Management', source: 'PCI DSS 4.0 Req 2' },
  { controlCode: 'PCI-2.1', title: 'Secure Configuration Processes Defined and Understood', description: 'Processes and mechanisms for applying secure configurations to all system components are defined and understood.', category: 'Configuration Management', source: 'PCI DSS 4.0 Req 2.1' },
  { controlCode: 'PCI-2.2', title: 'System Components Configured and Managed Securely', description: 'System components are configured and managed securely.', category: 'Configuration Management', source: 'PCI DSS 4.0 Req 2.2' },
  { controlCode: 'PCI-2.3', title: 'Wireless Environments Configured and Managed Securely', description: 'Wireless environments are configured and managed securely.', category: 'Configuration Management', source: 'PCI DSS 4.0 Req 2.3' },

  // Req 3
  { controlCode: 'PCI-3', title: 'Protect Stored Account Data', description: 'Account data is protected wherever it is stored.', category: 'Data Protection', source: 'PCI DSS 4.0 Req 3' },
  { controlCode: 'PCI-3.1', title: 'Account Data Protection Processes Defined and Understood', description: 'Processes and mechanisms for protecting stored account data are defined and understood.', category: 'Data Protection', source: 'PCI DSS 4.0 Req 3.1' },
  { controlCode: 'PCI-3.2', title: 'Storage of Account Data Kept to a Minimum', description: 'Storage of account data is kept to a minimum.', category: 'Data Protection', source: 'PCI DSS 4.0 Req 3.2' },
  { controlCode: 'PCI-3.3', title: 'SAD Not Stored After Authorization', description: 'Sensitive authentication data (SAD) is not stored after authorization.', category: 'Data Protection', source: 'PCI DSS 4.0 Req 3.3' },
  { controlCode: 'PCI-3.4', title: 'Access to Displays of Full PAN Restricted', description: 'Access to displays of full PAN and ability to copy PAN is restricted.', category: 'Data Protection', source: 'PCI DSS 4.0 Req 3.4' },
  { controlCode: 'PCI-3.5', title: 'PAN Rendered Unreadable Anywhere It Is Stored', description: 'Primary account number (PAN) is secured wherever it is stored.', category: 'Cryptography', source: 'PCI DSS 4.0 Req 3.5' },
  { controlCode: 'PCI-3.6', title: 'Cryptographic Keys Used to Protect Stored Account Data Secured', description: 'Cryptographic keys used to protect stored account data are secured.', category: 'Cryptography', source: 'PCI DSS 4.0 Req 3.6' },
  { controlCode: 'PCI-3.7', title: 'Cryptographic Key Management Procedures Documented and Implemented', description: 'Where cryptography is used to protect stored account data, key management processes and procedures covering generation, distribution, storage, etc. are defined and implemented.', category: 'Cryptography', source: 'PCI DSS 4.0 Req 3.7' },

  // Req 4
  { controlCode: 'PCI-4', title: 'Protect Cardholder Data with Strong Cryptography During Transmission', description: 'Cardholder data is protected with strong cryptography during transmission over open, public networks.', category: 'Cryptography', source: 'PCI DSS 4.0 Req 4' },
  { controlCode: 'PCI-4.1', title: 'Transmission Protection Processes Defined and Understood', description: 'Processes and mechanisms for protecting cardholder data with strong cryptography during transmission over open, public networks are defined and understood.', category: 'Cryptography', source: 'PCI DSS 4.0 Req 4.1' },
  { controlCode: 'PCI-4.2', title: 'PAN Protected with Strong Cryptography During Transmission', description: 'PAN is protected with strong cryptography during transmission.', category: 'Cryptography', source: 'PCI DSS 4.0 Req 4.2' },

  // Req 5
  { controlCode: 'PCI-5', title: 'Protect All Systems and Networks from Malicious Software', description: 'All systems and networks are protected from malicious software.', category: 'Endpoint Protection', source: 'PCI DSS 4.0 Req 5' },
  { controlCode: 'PCI-5.1', title: 'Malware Protection Processes Defined and Understood', description: 'Processes and mechanisms for protecting all systems and networks from malicious software are defined and understood.', category: 'Endpoint Protection', source: 'PCI DSS 4.0 Req 5.1' },
  { controlCode: 'PCI-5.2', title: 'Malicious Software (Malware) Prevented or Detected and Addressed', description: 'Malicious software (malware) is prevented, or detected and addressed.', category: 'Endpoint Protection', source: 'PCI DSS 4.0 Req 5.2' },
  { controlCode: 'PCI-5.3', title: 'Anti-Malware Mechanisms and Processes Active and Maintained', description: 'Anti-malware mechanisms and processes are active, maintained, and monitored.', category: 'Endpoint Protection', source: 'PCI DSS 4.0 Req 5.3' },
  { controlCode: 'PCI-5.4', title: 'Anti-Phishing Mechanisms Protect Users', description: 'Anti-phishing mechanisms protect users against phishing attacks.', category: 'Endpoint Protection', source: 'PCI DSS 4.0 Req 5.4' },

  // Req 6
  { controlCode: 'PCI-6', title: 'Develop and Maintain Secure Systems and Software', description: 'Secure systems and software are developed and maintained.', category: 'Secure SDLC', source: 'PCI DSS 4.0 Req 6' },
  { controlCode: 'PCI-6.1', title: 'Secure Development Processes Defined and Understood', description: 'Processes and mechanisms for developing and maintaining secure systems and software are defined and understood.', category: 'Secure SDLC', source: 'PCI DSS 4.0 Req 6.1' },
  { controlCode: 'PCI-6.2', title: 'Bespoke and Custom Software Developed Securely', description: 'Bespoke and custom software are developed securely.', category: 'Secure SDLC', source: 'PCI DSS 4.0 Req 6.2' },
  { controlCode: 'PCI-6.3', title: 'Security Vulnerabilities Identified and Addressed', description: 'Security vulnerabilities are identified and addressed.', category: 'Vulnerability Management', source: 'PCI DSS 4.0 Req 6.3' },
  { controlCode: 'PCI-6.4', title: 'Public-Facing Web Applications Protected Against Attacks', description: 'Public-facing web applications are protected against attacks.', category: 'Application Security', source: 'PCI DSS 4.0 Req 6.4' },
  { controlCode: 'PCI-6.5', title: 'Changes to All System Components Managed Securely', description: 'Changes to all system components are managed securely.', category: 'Change Management', source: 'PCI DSS 4.0 Req 6.5' },

  // Req 7
  { controlCode: 'PCI-7', title: 'Restrict Access to System Components and Cardholder Data by Business Need to Know', description: 'Access to system components and cardholder data is restricted by business need to know.', category: 'Access Control', source: 'PCI DSS 4.0 Req 7' },
  { controlCode: 'PCI-7.1', title: 'Access Restriction Processes Defined and Understood', description: 'Processes and mechanisms for restricting access to system components and cardholder data by business need to know are defined and understood.', category: 'Access Control', source: 'PCI DSS 4.0 Req 7.1' },
  { controlCode: 'PCI-7.2', title: 'Access to System Components and Data Appropriately Defined and Assigned', description: 'Access to system components and data is appropriately defined and assigned.', category: 'Access Control', source: 'PCI DSS 4.0 Req 7.2' },
  { controlCode: 'PCI-7.3', title: 'Access to System Components and Data Managed via Access Control Systems', description: 'Access to system components and data is managed via an access control system(s).', category: 'Access Control', source: 'PCI DSS 4.0 Req 7.3' },

  // Req 8
  { controlCode: 'PCI-8', title: 'Identify Users and Authenticate Access to System Components', description: 'Users are identified and access to system components is authenticated.', category: 'Authentication', source: 'PCI DSS 4.0 Req 8' },
  { controlCode: 'PCI-8.1', title: 'Identification and Authentication Processes Defined and Understood', description: 'Processes and mechanisms for identifying users and authenticating access to system components are defined and understood.', category: 'Authentication', source: 'PCI DSS 4.0 Req 8.1' },
  { controlCode: 'PCI-8.2', title: 'User Identification and Related Accounts Strictly Managed', description: 'User identification and related accounts for users and administrators are strictly managed throughout the account lifecycle.', category: 'Authentication', source: 'PCI DSS 4.0 Req 8.2' },
  { controlCode: 'PCI-8.3', title: 'Strong Authentication for Users and Administrators Established', description: 'Strong authentication for users and administrators is established and managed.', category: 'Authentication', source: 'PCI DSS 4.0 Req 8.3' },
  { controlCode: 'PCI-8.4', title: 'Multi-Factor Authentication (MFA) Implemented', description: 'Multi-factor authentication (MFA) is implemented to secure access into the CDE.', category: 'Authentication', source: 'PCI DSS 4.0 Req 8.4' },
  { controlCode: 'PCI-8.5', title: 'MFA Systems Configured to Prevent Bypass', description: 'Multi-factor authentication systems are configured to prevent misuse.', category: 'Authentication', source: 'PCI DSS 4.0 Req 8.5' },
  { controlCode: 'PCI-8.6', title: 'Use of Application and System Accounts Managed', description: 'Use of application and system accounts and associated authentication factors is strictly managed.', category: 'Authentication', source: 'PCI DSS 4.0 Req 8.6' },

  // Req 9
  { controlCode: 'PCI-9', title: 'Restrict Physical Access to Cardholder Data', description: 'Physical access to cardholder data is restricted.', category: 'Physical Security', source: 'PCI DSS 4.0 Req 9' },
  { controlCode: 'PCI-9.1', title: 'Physical Access Processes Defined and Understood', description: 'Processes and mechanisms for restricting physical access to cardholder data are defined and understood.', category: 'Physical Security', source: 'PCI DSS 4.0 Req 9.1' },
  { controlCode: 'PCI-9.2', title: 'Physical Access Controls Manage Entry into Facilities and Systems', description: 'Physical access controls manage entry into facilities and systems that store, process, or transmit cardholder data.', category: 'Physical Security', source: 'PCI DSS 4.0 Req 9.2' },
  { controlCode: 'PCI-9.3', title: 'Physical Access for Personnel and Visitors Authorized and Managed', description: 'Physical access for personnel and visitors is authorized and managed.', category: 'Physical Security', source: 'PCI DSS 4.0 Req 9.3' },
  { controlCode: 'PCI-9.4', title: 'Media with Cardholder Data Secured', description: 'Media with cardholder data is secured.', category: 'Physical Security', source: 'PCI DSS 4.0 Req 9.4' },
  { controlCode: 'PCI-9.5', title: 'POI Devices Protected from Tampering and Unauthorized Substitution', description: 'Point-of-interaction (POI) devices are protected from tampering and unauthorized substitution.', category: 'Physical Security', source: 'PCI DSS 4.0 Req 9.5' },

  // Req 10
  { controlCode: 'PCI-10', title: 'Log and Monitor All Access to System Components and Cardholder Data', description: 'All access to system components and cardholder data is logged and monitored.', category: 'Logging & Monitoring', source: 'PCI DSS 4.0 Req 10' },
  { controlCode: 'PCI-10.1', title: 'Logging and Monitoring Processes Defined and Understood', description: 'Processes and mechanisms for logging and monitoring all access to system components and cardholder data are defined and understood.', category: 'Logging & Monitoring', source: 'PCI DSS 4.0 Req 10.1' },
  { controlCode: 'PCI-10.2', title: 'Audit Logs Implemented to Support Detection of Anomalies', description: 'Audit logs are implemented to support the detection of anomalies and suspicious activity, and the forensic analysis of events.', category: 'Logging & Monitoring', source: 'PCI DSS 4.0 Req 10.2' },
  { controlCode: 'PCI-10.3', title: 'Audit Logs Protected from Destruction and Unauthorized Modifications', description: 'Audit logs are protected from destruction and unauthorized modifications.', category: 'Logging & Monitoring', source: 'PCI DSS 4.0 Req 10.3' },
  { controlCode: 'PCI-10.4', title: 'Audit Logs Reviewed to Identify Anomalies or Suspicious Activity', description: 'Audit logs are reviewed to identify anomalies or suspicious activity.', category: 'Logging & Monitoring', source: 'PCI DSS 4.0 Req 10.4' },
  { controlCode: 'PCI-10.5', title: 'Audit Log History Retained and Available for Analysis', description: 'Audit log history is retained and available for analysis.', category: 'Logging & Monitoring', source: 'PCI DSS 4.0 Req 10.5' },
  { controlCode: 'PCI-10.6', title: 'Time-Synchronization Mechanisms Support Consistent Time', description: 'Time-synchronization mechanisms support consistent time settings across all systems.', category: 'Logging & Monitoring', source: 'PCI DSS 4.0 Req 10.6' },
  { controlCode: 'PCI-10.7', title: 'Failures of Critical Security Control Systems Detected and Responded To', description: 'Failures of critical security control systems are detected, reported, and responded to promptly.', category: 'Logging & Monitoring', source: 'PCI DSS 4.0 Req 10.7' },

  // Req 11
  { controlCode: 'PCI-11', title: 'Test Security of Systems and Networks Regularly', description: 'Security of systems and networks is regularly tested.', category: 'Security Testing', source: 'PCI DSS 4.0 Req 11' },
  { controlCode: 'PCI-11.1', title: 'Security Testing Processes Defined and Understood', description: 'Processes and mechanisms for regularly testing security of systems and networks are defined and understood.', category: 'Security Testing', source: 'PCI DSS 4.0 Req 11.1' },
  { controlCode: 'PCI-11.2', title: 'Wireless Access Points Managed and Controlled', description: 'Wireless access points are identified and monitored, and unauthorized wireless access points are addressed.', category: 'Security Testing', source: 'PCI DSS 4.0 Req 11.2' },
  { controlCode: 'PCI-11.3', title: 'External and Internal Vulnerabilities Regularly Identified and Addressed', description: 'External and internal vulnerabilities are regularly identified, prioritized, and addressed.', category: 'Security Testing', source: 'PCI DSS 4.0 Req 11.3' },
  { controlCode: 'PCI-11.4', title: 'External and Internal Penetration Testing Performed Regularly', description: 'External and internal penetration testing is regularly performed, and exploitable vulnerabilities and security weaknesses are corrected.', category: 'Security Testing', source: 'PCI DSS 4.0 Req 11.4' },
  { controlCode: 'PCI-11.5', title: 'Network Intrusions and Unexpected File Changes Detected and Responded To', description: 'Network intrusions and unexpected file changes are detected and responded to.', category: 'Security Testing', source: 'PCI DSS 4.0 Req 11.5' },
  { controlCode: 'PCI-11.6', title: 'Unauthorized Changes on Payment Pages Detected and Responded To', description: 'Unauthorized changes on payment pages are detected and responded to.', category: 'Security Testing', source: 'PCI DSS 4.0 Req 11.6' },

  // Req 12
  { controlCode: 'PCI-12', title: 'Support Information Security with Organizational Policies and Programs', description: 'Information security is supported by organizational policies and programs.', category: 'Governance & Policies', source: 'PCI DSS 4.0 Req 12' },
  { controlCode: 'PCI-12.1', title: 'Information Security Policy Comprehensive and Maintained', description: 'A comprehensive information security policy that governs and provides direction for protection of the entity’s information assets is known and current to all personnel.', category: 'Governance & Policies', source: 'PCI DSS 4.0 Req 12.1' },
  { controlCode: 'PCI-12.2', title: 'Acceptable Use Policies for End-User Technologies Defined', description: 'Acceptable use policies for end-user technologies are defined and implemented.', category: 'Governance & Policies', source: 'PCI DSS 4.0 Req 12.2' },
  { controlCode: 'PCI-12.3', title: 'Risks to the CDE Are Formally Identified, Evaluated, and Managed', description: 'Risks to the cardholder data environment are formally identified, evaluated, and managed.', category: 'Risk Management', source: 'PCI DSS 4.0 Req 12.3' },
  { controlCode: 'PCI-12.4', title: 'PCI DSS Compliance Managed', description: 'PCI DSS compliance is managed.', category: 'Compliance', source: 'PCI DSS 4.0 Req 12.4' },
  { controlCode: 'PCI-12.5', title: 'PCI DSS Scope Documented and Validated', description: 'PCI DSS scope is documented and validated.', category: 'Compliance', source: 'PCI DSS 4.0 Req 12.5' },
  { controlCode: 'PCI-12.6', title: 'Security Awareness Education Ongoing', description: 'Security awareness education is an ongoing activity.', category: 'Awareness', source: 'PCI DSS 4.0 Req 12.6' },
  { controlCode: 'PCI-12.7', title: 'Personnel Screened to Reduce Risks from Insider Threats', description: 'Personnel are screened to reduce risks from insider threats.', category: 'HR Security', source: 'PCI DSS 4.0 Req 12.7' },
  { controlCode: 'PCI-12.8', title: 'Risks from Service Providers Managed', description: 'Risks to information assets related to third-party service provider (TPSP) relationships are managed.', category: 'Third-Party Risk', source: 'PCI DSS 4.0 Req 12.8' },
  { controlCode: 'PCI-12.9', title: 'TPSPs Support Customers PCI DSS Compliance', description: 'Third-party service providers support their customers’ PCI DSS compliance.', category: 'Third-Party Risk', source: 'PCI DSS 4.0 Req 12.9' },
  { controlCode: 'PCI-12.10', title: 'Suspected or Confirmed Security Incidents Responded To Immediately', description: 'Suspected or confirmed security incidents that could impact the CDE are responded to immediately.', category: 'Incident Response', source: 'PCI DSS 4.0 Req 12.10' },
];
