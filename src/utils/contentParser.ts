type RequirementItem = {
  id: string;
  statement: string;
  [key: string]: unknown;
};

type SimpleRequirement = {
  id: string;
  statement: string;
};

type SrsContent = {
  functionalRequirements?: RequirementItem[];
  nonFunctionalRequirements?: Record<string, RequirementItem[]>;
};

/**
 * Convert FR from content.functionalRequirements
 */
export function convertFR(content: SrsContent): SimpleRequirement[] {
  return (content.functionalRequirements ?? []).map((req) => ({
    id: req.id.toLowerCase(),
    statement: req.statement,
  }));
}

/**
 * Convert NFR from content.nonFunctionalRequirements
 */
export function convertNFR(content: SrsContent): SimpleRequirement[] {
  const nfrGroups = content.nonFunctionalRequirements ?? {};

  return Object.values(nfrGroups)
    .flat()
    .map((req) => ({
      id: req.id.toLowerCase(),
      statement: req.statement,
    }));
}