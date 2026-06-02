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
