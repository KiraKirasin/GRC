import { RiskCriterion } from '../types';

export const CRITERIA: RiskCriterion[] = [
  { id: 1, category: 'Комплаєнс', categoryKey: 'Комплаєнс', subcategory: 'ISO 27001', subcategoryKey: 'ISO 27001', criterion: 'Підтримка ISMS та визначення сфери застосування', criterionKey: 'criteria.1', source: 'ISO/DSTU 27001' },
  { id: 2, category: 'Комплаєнс', categoryKey: 'Комплаєнс', subcategory: 'ISO 27001', subcategoryKey: 'ISO 27001', criterion: 'Statement of Applicability / Заява про застосовність', criterionKey: 'criteria.2', source: 'ISO/DSTU 27001' },
  { id: 3, category: 'Комплаєнс', categoryKey: 'Комплаєнс', subcategory: 'ISO 27001', subcategoryKey: 'ISO 27001', criterion: 'Бібліотека контролів та мапінг на вимоги', criterionKey: 'criteria.3', source: 'ISO/DSTU 27001' },
  { id: 4, category: 'Комплаєнс', categoryKey: 'Комплаєнс', subcategory: 'ISO 27001', subcategoryKey: 'ISO 27001', criterion: 'Управління політиками та процедурами', criterionKey: 'criteria.4', source: 'ISO/DSTU 27001' },
  { id: 5, category: 'Комплаєнс', categoryKey: 'Комплаєнс', subcategory: 'ISO 27001', subcategoryKey: 'ISO 27001', criterion: 'Внутрішній аудит ISMS', criterionKey: 'criteria.5', source: 'ISO/DSTU 27001' },
  { id: 6, category: 'Комплаєнс', categoryKey: 'Комплаєнс', subcategory: 'PCI DSS', subcategoryKey: 'PCI DSS', criterion: 'Мапінг контролів PCI DSS 4.0', criterionKey: 'criteria.6', source: 'PCI DSS' },
  { id: 7, category: 'Комплаєнс', categoryKey: 'Комплаєнс', subcategory: 'PCI DSS', subcategoryKey: 'PCI DSS', criterion: 'Збір доказів для PCI DSS', criterionKey: 'criteria.7', source: 'PCI DSS' },
  { id: 8, category: 'Комплаєнс', categoryKey: 'Комплаєнс', subcategory: 'PCI DSS', subcategoryKey: 'PCI DSS', criterion: 'Підтримка компенсуючих контролів', criterionKey: 'criteria.8', source: 'PCI DSS' },
  { id: 9, category: 'Комплаєнс', categoryKey: 'Комплаєнс', subcategory: 'GDPR', subcategoryKey: 'GDPR', criterion: 'DPIA / Оцінка впливу на захист даних', criterionKey: 'criteria.9', source: 'GDPR' },
  { id: 10, category: 'Комплаєнс', categoryKey: 'Комплаєнс', subcategory: 'GDPR', subcategoryKey: 'GDPR', criterion: 'Реєстр операцій обробки персональних даних', criterionKey: 'criteria.10', source: 'GDPR' },
  { id: 11, category: 'Комплаєнс', categoryKey: 'Комплаєнс', subcategory: 'GDPR', subcategoryKey: 'GDPR', criterion: 'Реєстр порушень персональних даних', criterionKey: 'criteria.11', source: 'GDPR' },
  { id: 12, category: 'Комплаєнс', categoryKey: 'Комплаєнс', subcategory: 'DORA', subcategoryKey: 'DORA', criterion: 'Реєстр ICT-ризиків та критичних функцій', criterionKey: 'criteria.12', source: 'DORA' },
  { id: 13, category: 'Комплаєнс', categoryKey: 'Комплаєнс', subcategory: 'DORA', subcategoryKey: 'DORA', criterion: 'Мапінг ICT-постачальників та критичних сервісів', criterionKey: 'criteria.13', source: 'DORA' },
  { id: 14, category: 'Комплаєнс', categoryKey: 'Комплаєнс', subcategory: 'NIS2', subcategoryKey: 'NIS2', criterion: 'Мапінг вимог NIS2', criterionKey: 'criteria.14', source: 'NIS2' },
  { id: 15, category: 'Ризики', categoryKey: 'Ризики', subcategory: 'IT Risk', subcategoryKey: 'IT Risk', criterion: 'Єдиний реєстр ІТ-ризиків', criterionKey: 'criteria.15', source: 'ERM/IT Risk' },
  { id: 16, category: 'Ризики', categoryKey: 'Ризики', subcategory: 'IT Risk', subcategoryKey: 'IT Risk', criterion: 'Оцінка inherent та residual risk', criterionKey: 'criteria.16', source: 'ERM/IT Risk' },
  { id: 17, category: 'Ризики', categoryKey: 'Ризики', subcategory: 'IT Risk', subcategoryKey: 'IT Risk', criterion: 'Плани обробки ризиків / mitigation plans', criterionKey: 'criteria.17', source: 'ERM/IT Risk' },
  { id: 18, category: 'Ризики', categoryKey: 'Ризики', subcategory: 'IT Risk', subcategoryKey: 'IT Risk', criterion: 'Власники ризиків та workflow погодження', criterionKey: 'criteria.18', source: 'ERM/IT Risk' },
  { id: 19, category: 'Ризики', categoryKey: 'Ризики', subcategory: 'IT Risk', subcategoryKey: 'IT Risk', criterion: 'KRI та порогові значення', criterionKey: 'criteria.19', source: 'ERM/IT Risk' },
  { id: 20, category: 'Ризики', categoryKey: 'Ризики', subcategory: 'IT Risk', subcategoryKey: 'IT Risk', criterion: 'Risk appetite та risk tolerance', criterionKey: 'criteria.20', source: 'ERM/IT Risk' },
  { id: 21, category: 'Ризики', categoryKey: 'Ризики', subcategory: 'IT Risk', subcategoryKey: 'IT Risk', criterion: 'Heatmaps та risk dashboards', criterionKey: 'criteria.21', source: 'ERM/IT Risk' },
  { id: 22, category: 'TPRM', categoryKey: 'TPRM', subcategory: 'Vendor Risk', subcategoryKey: 'Vendor Risk', criterion: 'Реєстр постачальників', criterionKey: 'criteria.22', source: 'TPRM/DORA' },
  { id: 23, category: 'TPRM', categoryKey: 'TPRM', subcategory: 'Vendor Risk', subcategoryKey: 'Vendor Risk', criterion: 'Анкети та self-assessment для постачальників', criterionKey: 'criteria.23', source: 'TPRM/DORA' },
  { id: 24, category: 'TPRM', categoryKey: 'TPRM', subcategory: 'Vendor Risk', subcategoryKey: 'Vendor Risk', criterion: 'Оцінка inherent/residual vendor risk', criterionKey: 'criteria.24', source: 'TPRM/DORA' },
  { id: 25, category: 'TPRM', categoryKey: 'TPRM', subcategory: 'Vendor Risk', subcategoryKey: 'Vendor Risk', criterion: 'Vendor portal для збору доказів', criterionKey: 'criteria.25', source: 'TPRM/DORA' },
  { id: 26, category: 'TPRM', categoryKey: 'TPRM', subcategory: 'Vendor Risk', subcategoryKey: 'Vendor Risk', criterion: 'Управління договорами та критичністю постачальника', criterionKey: 'criteria.26', source: 'TPRM/DORA' },
  { id: 27, category: 'BCP', categoryKey: 'BCP', subcategory: 'Operational Resilience', subcategoryKey: 'Operational Resilience', criterion: 'Business Impact Analysis (BIA)', criterionKey: 'criteria.27', source: 'BCP/DORA' },
  { id: 28, category: 'BCP', categoryKey: 'BCP', subcategory: 'Operational Resilience', subcategoryKey: 'Operational Resilience', criterion: 'Плани безперервності бізнесу', criterionKey: 'criteria.28', source: 'BCP/DORA' },
  { id: 29, category: 'BCP', categoryKey: 'BCP', subcategory: 'Operational Resilience', subcategoryKey: 'Operational Resilience', criterion: 'RTO/RPO та залежності сервісів', criterionKey: 'criteria.29', source: 'BCP/DORA' },
  { id: 30, category: 'BCP', categoryKey: 'BCP', subcategory: 'Operational Resilience', subcategoryKey: 'Operational Resilience', criterion: 'Тестування BCP/DR та збереження evidence', criterionKey: 'criteria.30', source: 'BCP/DORA' },
  { id: 31, category: 'Аудит', categoryKey: 'Аудит', subcategory: 'Controls & Audit', subcategoryKey: 'Controls & Audit', criterion: 'Планування внутрішніх аудитів', criterionKey: 'criteria.31', source: 'Audit' },
  { id: 32, category: 'Аудит', categoryKey: 'Аудит', subcategory: 'Controls & Audit', subcategoryKey: 'Controls & Audit', criterion: 'Тестування контролів', criterionKey: 'criteria.32', source: 'Audit' },
  { id: 33, category: 'Аудит', categoryKey: 'Аудит', subcategory: 'Controls & Audit', subcategoryKey: 'Controls & Audit', criterion: 'Findings, CAPA та рекомендації', criterionKey: 'criteria.33', source: 'Audit' },
  { id: 34, category: 'Аудит', categoryKey: 'Аудит', subcategory: 'Controls & Audit', subcategoryKey: 'Controls & Audit', criterion: 'Кампанії самооцінки', criterionKey: 'criteria.34', source: 'Audit' },
  { id: 35, category: 'Архітектура', categoryKey: 'Архітектура', subcategory: 'Integrations', subcategoryKey: 'Integrations', criterion: 'REST API / інтеграційний API', criterionKey: 'criteria.35', source: 'Technical' },
  { id: 36, category: 'Архітектура', categoryKey: 'Архітектура', subcategory: 'Integrations', subcategoryKey: 'Integrations', criterion: 'SSO / SAML / OIDC', criterionKey: 'criteria.36', source: 'Technical' },
  { id: 37, category: 'Архітектура', categoryKey: 'Архітектура', subcategory: 'Integrations', subcategoryKey: 'Integrations', criterion: 'Інтеграція з Jira / ServiceNow / ITSM', criterionKey: 'criteria.37', source: 'Technical' },
  { id: 38, category: 'Архітектура', categoryKey: 'Архітектура', subcategory: 'Integrations', subcategoryKey: 'Integrations', criterion: 'Імпорт/експорт Excel/CSV', criterionKey: 'criteria.38', source: 'Technical' },
  { id: 39, category: 'Звітність', categoryKey: 'Звітність', subcategory: 'BI', subcategoryKey: 'BI', criterion: 'Executive dashboards', criterionKey: 'criteria.39', source: 'Reporting' },
  { id: 40, category: 'Звітність', categoryKey: 'Звітність', subcategory: 'BI', subcategoryKey: 'BI', criterion: 'Кастомні звіти та експорт у BI', criterionKey: 'criteria.40', source: 'Reporting' },
  { id: 41, category: 'Адміністрування', categoryKey: 'Адміністрування', subcategory: 'Workflow', subcategoryKey: 'Workflow', criterion: 'No-code/low-code workflow builder', criterionKey: 'criteria.41', source: 'Administration' },
  { id: 42, category: 'Адміністрування', categoryKey: 'Адміністрування', subcategory: 'Workflow', subcategoryKey: 'Workflow', criterion: 'Кастомні поля, форми та статуси', criterionKey: 'criteria.42', source: 'Administration' },
  { id: 43, category: 'Безпека', categoryKey: 'Безпека', subcategory: 'Platform Security', subcategoryKey: 'Platform Security', criterion: 'RBAC та segregation of duties', criterionKey: 'criteria.43', source: 'Security' },
  { id: 44, category: 'Безпека', categoryKey: 'Безпека', subcategory: 'Platform Security', subcategoryKey: 'Platform Security', criterion: 'Audit trail для змін у системі', criterionKey: 'criteria.44', source: 'Security' },
  { id: 45, category: 'Безпека', categoryKey: 'Безпека', subcategory: 'Platform Security', subcategoryKey: 'Platform Security', criterion: 'Шифрування в transit / at rest', criterionKey: 'criteria.45', source: 'Security' },
  { id: 46, category: 'Безпека', categoryKey: 'Безпека', subcategory: 'Platform Security', subcategoryKey: 'Platform Security', criterion: 'Backup / restore / DR для платформи', criterionKey: 'criteria.46', source: 'Security' },
  { id: 47, category: 'UX', categoryKey: 'UX', subcategory: 'Adoption', subcategoryKey: 'Adoption', criterion: 'Зручність використання для бізнес-користувачів', criterionKey: 'criteria.47', source: 'UX' },
  { id: 48, category: 'UX', categoryKey: 'UX', subcategory: 'Adoption', subcategoryKey: 'Adoption', criterion: 'Документація та навчальні матеріали', criterionKey: 'criteria.48', source: 'UX' },
  { id: 49, category: 'TCO', categoryKey: 'TCO', subcategory: 'Cost', subcategoryKey: 'Cost', criterion: 'Ліцензія / subscription', criterionKey: 'criteria.49', source: 'TCO' },
  { id: 50, category: 'TCO', categoryKey: 'TCO', subcategory: 'Cost', subcategoryKey: 'Cost', criterion: 'Вартість впровадження та міграції', criterionKey: 'criteria.50', source: 'TCO' },
  { id: 51, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'Постанова НБУ №187', subcategoryKey: 'Постанова НБУ №187', criterion: 'Ведення реєстру інформаційних активів', criterionKey: 'criteria.51', source: 'НБУ №187' },
  { id: 52, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'Постанова НБУ №187', subcategoryKey: 'Постанова НБУ №187', criterion: 'Реєстр інформаційних ризиків', criterionKey: 'criteria.52', source: 'НБУ №187' },
  { id: 53, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'Постанова НБУ №187', subcategoryKey: 'Постанова НБУ №187', criterion: 'Каталог заходів захисту інформації', criterionKey: 'criteria.53', source: 'НБУ №187' },
  { id: 54, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'Постанова НБУ №187', subcategoryKey: 'Постанова НБУ №187', criterion: 'Управління інцидентами інформаційної безпеки', criterionKey: 'criteria.54', source: 'НБУ №187' },
  { id: 55, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'Постанова НБУ №187', subcategoryKey: 'Постанова НБУ №187', criterion: 'Облік подій інформаційної безпеки та evidence', criterionKey: 'criteria.55', source: 'НБУ №187' },
  { id: 56, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'Постанова НБУ №187', subcategoryKey: 'Постанова НБУ №187', criterion: 'Контроль доступу та ролей користувачів', criterionKey: 'criteria.56', source: 'НБУ №187' },
  { id: 57, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'Постанова НБУ №187', subcategoryKey: 'Постанова НБУ №187', criterion: 'Управління вразливостями', criterionKey: 'criteria.57', source: 'НБУ №187' },
  { id: 58, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'Постанова НБУ №187', subcategoryKey: 'Постанова НБУ №187', criterion: 'Звітність для НБУ / регуляторна звітність', criterionKey: 'criteria.58', source: 'НБУ №187' },
  { id: 59, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'Постанова НБУ №43', subcategoryKey: 'Постанова НБУ №43', criterion: 'Реєстр ризиків та єдина таксономія ризиків', criterionKey: 'criteria.59', source: 'НБУ №43' },
  { id: 60, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'Постанова НБУ №43', subcategoryKey: 'Постанова НБУ №43', criterion: 'Risk Appetite Framework', criterionKey: 'criteria.60', source: 'НБУ №43' },
  { id: 61, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'Постанова НБУ №43', subcategoryKey: 'Постанова НБУ №43', criterion: 'KRI та контроль порогових значень', criterionKey: 'criteria.61', source: 'НБУ №43' },
  { id: 62, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'Постанова НБУ №43', subcategoryKey: 'Постанова НБУ №43', criterion: 'Управління операційним ризиком', criterionKey: 'criteria.62', source: 'НБУ №43' },
  { id: 63, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'Постанова НБУ №43', subcategoryKey: 'Постанова НБУ №43', criterion: 'Управління ІТ-ризиками та ІБ-ризиками', criterionKey: 'criteria.63', source: 'НБУ №43' },
  { id: 64, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'Постанова НБУ №43', subcategoryKey: 'Постанова НБУ №43', criterion: 'Звітність для Правління / Наглядової ради', criterionKey: 'criteria.64', source: 'НБУ №43' },
  { id: 65, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'ДСТУ ISO/IEC 27001', subcategoryKey: 'ДСТУ ISO/IEC 27001', criterion: 'Контекст організації, лідерство, планування ISMS', criterionKey: 'criteria.65', source: 'ДСТУ ISO/IEC 27001' },
  { id: 66, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'ДСТУ ISO/IEC 27001', subcategoryKey: 'ДСТУ ISO/IEC 27001', criterion: 'Оцінювання результативності ISMS', criterionKey: 'criteria.66', source: 'ДСТУ ISO/IEC 27001' },
  { id: 67, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'ДСТУ ISO/IEC 27001', subcategoryKey: 'ДСТУ ISO/IEC 27001', criterion: 'Управління невідповідностями та коригувальними діями', criterionKey: 'criteria.67', source: 'ДСТУ ISO/IEC 27001' },
  { id: 68, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'ДСТУ ISO/IEC 27002', subcategoryKey: 'ДСТУ ISO/IEC 27002', criterion: 'Політики інформаційної безпеки', criterionKey: 'criteria.68', source: 'ДСТУ ISO/IEC 27002' },
  { id: 69, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'ДСТУ ISO/IEC 27002', subcategoryKey: 'ДСТУ ISO/IEC 27002', criterion: 'Управління активами та класифікація інформації', criterionKey: 'criteria.69', source: 'ДСТУ ISO/IEC 27002' },
  { id: 70, category: 'Українські нормативні вимоги', categoryKey: 'Українські нормативні вимоги', subcategory: 'ДСТУ ISO/IEC 27002', subcategoryKey: 'ДСТУ ISO/IEC 27002', criterion: 'Управління постачальниками та third-party security', criterionKey: 'criteria.70', source: 'ДСТУ ISO/IEC 27002' },
];

export function getCriteriaById(id: number): RiskCriterion | undefined {
  return CRITERIA.find((c) => c.id === id);
}

export function getCategories(): string[] {
  return [...new Set(CRITERIA.map((c) => c.category))];
}

export function getSubcategories(): string[] {
  return [...new Set(CRITERIA.map((c) => c.subcategory))];
}

export function getCategorySubcategories(category: string): string[] {
  return [...new Set(CRITERIA.filter((c) => c.category === category).map((c) => c.subcategory))];
}
