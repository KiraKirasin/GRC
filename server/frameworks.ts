/** Preferred project frameworks (Create Project dropdown order) */
export const PROJECT_FRAMEWORK_OPTIONS = [
  {
    name: 'NBU Resolution №95',
    shortName: 'НБУ №95',
    aliases: ['NBU Resolution №95', 'НБУ №95', 'NBU №95', 'NBU 95'],
    sourcePatterns: [/NBU\s*[№#]?\s*95\b/i, /№\s*95\b/],
  },
  {
    name: 'NBU Resolution №143',
    shortName: 'НБУ №143',
    aliases: ['NBU Resolution №143', 'НБУ №143', 'NBU №143', 'NBU 143'],
    sourcePatterns: [/NBU\s*[№#]?\s*143\b/i, /№\s*143\b/],
  },
  {
    name: 'PCI DSS 4.0',
    shortName: 'PCI DSS',
    aliases: ['PCI DSS 4.0', 'PCI DSS', 'PCI DSS 4', 'PCI DSS v4.0.1'],
    sourcePatterns: [/PCI\s*DSS/i],
  },
  {
    name: 'ISO 27001',
    shortName: 'ISO 27001',
    aliases: ['ISO 27001', 'ISO/IEC 27001', 'ISO 27001:2022'],
    sourcePatterns: [/ISO(?:\/IEC)?\s*27001/i],
  },
  {
    name: 'Other',
    shortName: 'Other',
    aliases: ['Other', 'Enterprise Control Library', 'ECL'],
    sourcePatterns: [] as RegExp[],
  },
] as const;

export type FrameworkOption = (typeof PROJECT_FRAMEWORK_OPTIONS)[number];

export function findFrameworkOption(name: string): FrameworkOption | undefined {
  const normalized = name.trim().toLowerCase();
  return PROJECT_FRAMEWORK_OPTIONS.find(opt =>
    opt.name.toLowerCase() === normalized ||
    opt.aliases.some(a => a.toLowerCase() === normalized) ||
    opt.shortName.toLowerCase() === normalized
  );
}

type ControlLike = {
  framework: string;
  source: string;
};

function matchesOption(control: ControlLike, opt: FrameworkOption): boolean {
  if (opt.name === 'Other') {
    return control.framework === 'Enterprise Control Library' ||
      control.framework === 'Other' ||
      control.framework === '';
  }

  if (opt.aliases.some(a => a === control.framework) || control.framework === opt.name) {
    return true;
  }

  return opt.sourcePatterns.some(re => re.test(control.source || ''));
}

export function filterControlsForFramework<T extends ControlLike>(controls: T[], frameworkName: string): T[] {
  const opt = findFrameworkOption(frameworkName);
  if (!opt) {
    return controls.filter(c => c.framework === frameworkName);
  }

  // Prefer exact framework field matches (dedicated library in Controls Repository)
  const exact = controls.filter(c =>
    opt.aliases.some(a => a === c.framework) || c.framework === opt.name
  );
  if (exact.length > 0) return exact;

  if (opt.name === 'Other') {
    const ecl = controls.filter(c => c.framework === 'Enterprise Control Library');
    if (ecl.length > 0) return ecl;
    return controls.filter(c => matchesOption(c, opt));
  }

  const matched = controls.filter(c => matchesOption(c, opt));
  if (matched.length > 0) return matched;

  // Fallback: ECL master library mapped to standards
  return controls.filter(c => c.framework === 'Enterprise Control Library');
}
