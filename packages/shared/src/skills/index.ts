/**
 * Skill matching for job ↔ vendor pairing.
 * Case-insensitive; token-based so fridge_repairing matches repairing_fridge
 * and work_electrical matches electrical.
 */

/** Normalize user input: lowercase, spaces → underscores, strip invalid chars. */
export function normalizeSkillInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Parse comma-separated skills from a form field. */
export function parseSkillList(input: string): string[] {
  return input
    .split(',')
    .map(normalizeSkillInput)
    .filter(Boolean);
}

/** Tokenize a normalized skill slug (e.g. work_electrical → [work, electrical]). */
export function skillTokens(skill: string): string[] {
  return normalizeSkillInput(skill)
    .split('_')
    .filter((t) => t.length > 0);
}

/**
 * True when two skill slugs refer to the same capability.
 * - Exact match after normalize (hvac === HVAC)
 * - Same token bag in any order (fridge_repairing ↔ repairing_fridge)
 * - Subset tokens (electrical ⊆ work_electrical)
 */
export function skillsEquivalent(a: string, b: string): boolean {
  const na = normalizeSkillInput(a);
  const nb = normalizeSkillInput(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const ta = new Set(skillTokens(na));
  const tb = new Set(skillTokens(nb));
  if (ta.size === 0 || tb.size === 0) return false;

  const [smaller, larger] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  for (const token of smaller) {
    if (!larger.has(token)) return false;
  }
  return true;
}

/** True if any required job skill matches any vendor skill. */
export function vendorMatchesRequiredSkills(
  requiredSkills: string[],
  vendorSkills: string[],
): boolean {
  const required = requiredSkills.map(normalizeSkillInput).filter(Boolean);
  if (required.length === 0) return true;

  const vendor = vendorSkills.map(normalizeSkillInput).filter(Boolean);
  if (vendor.length === 0) return false;

  return required.some((req) => vendor.some((vs) => skillsEquivalent(req, vs)));
}

/** Count of required skills matched (0–1 scale for scoring). */
export function scoreSkillMatch(required: string[], vendorSkills: string[]): number {
  const reqs = required.map(normalizeSkillInput).filter(Boolean);
  if (reqs.length === 0) return 0.5;

  const vendor = vendorSkills.map(normalizeSkillInput).filter(Boolean);
  if (vendor.length === 0) return 0;

  const matches = reqs.filter((req) =>
    vendor.some((vs) => skillsEquivalent(req, vs)),
  ).length;
  return matches / reqs.length;
}

/** Human-readable matched skill labels for AI / UI copy. */
export function matchedSkillLabels(
  requiredSkills: string[],
  vendorSkills: string[],
): string[] {
  const vendor = vendorSkills.map(normalizeSkillInput).filter(Boolean);
  return requiredSkills
    .map(normalizeSkillInput)
    .filter(Boolean)
    .filter((req) => vendor.some((vs) => skillsEquivalent(req, vs)));
}
