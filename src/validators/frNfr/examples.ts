import { GeneratedRequirementsDocument } from '../../types/frNfrValidation';
import { getAutoFixSuggestionsFromValidation, validateGeneratedRequirements } from './index';

export const exampleFrNfrInput: GeneratedRequirementsDocument = {
  projectName: 'Clinic Appointment Booking System',
  assumptions: ['Users access the system via a web browser'],
  constraints: ['Prototype scope only supports web usage'],
  features: [
    {
      id: 'FEAT-001',
      name: 'Appointment Booking',
      description: 'Patients can book and manage appointments',
      priority: 'High',
    },
  ],
  useCases: [
    {
      id: 'UC-001',
      name: 'Book Appointment',
      goal: 'Patient books an appointment with a doctor',
      primaryActors: ['Patient'],
      preconditions: ['Patient is logged in'],
      trigger: 'Patient selects an available slot',
      mainFlow: ['Patient chooses doctor', 'Patient selects slot', 'System confirms booking'],
      postconditions: ['Appointment is recorded'],
      relatedFeatures: ['FEAT-001'],
    },
  ],
  functionalRequirements: [
    {
      id: 'FR-001',
      title: 'Patient can book appointment',
      statement: 'The system shall allow a patient to book an appointment with an available doctor.',
      category: 'Workflow',
      rationale: 'Supports the core clinic booking process.',
      source: ['Project Description'],
      priority: 'High',
      fitCriterion:
        'A logged-in patient can select a doctor, choose an available time slot, and receive a booking confirmation.',
      verificationMethod: 'Test',
      preconditions: ['Patient is logged in'],
      postconditions: ['Appointment record is created'],
      dependsOn: [],
      conflictsWith: [],
      traceToFeatures: ['FEAT-001'],
      traceToUseCases: ['UC-001'],
      notes: '',
    },
  ],
  nonFunctionalRequirements: {
    performanceRequirements: [
      {
        id: 'NFR-PERF-001',
        title: 'Booking response time',
        statement:
          'The system shall return appointment booking confirmation within 3 seconds for 95% of valid booking requests under normal operating conditions.',
        rationale: 'Supports responsive user interaction.',
        source: ['Assumption'],
        priority: 'Medium',
        fitCriterion:
          'In performance testing with normal expected load, 95% of booking confirmation responses complete within 3 seconds.',
        verificationMethod: 'Performance Test',
        traceToFeatures: ['FEAT-001'],
        notes: '',
      },
    ],
    securityRequirements: [],
    usabilityRequirements: [],
    reliabilityRequirements: [],
    availabilityRequirements: [],
    maintainabilityRequirements: [],
    portabilityRequirements: [],
    scalabilityRequirements: [],
    auditabilityRequirements: [],
    accessibilityRequirements: [],
    backupRecoveryRequirements: [],
    complianceRequirements: [],
  },
  qualityCheckSummary: {
    completenessNotes: [],
    ambiguityRisks: [],
    consistencyRisks: [],
    duplicationRisks: [],
    missingTraceLinks: [],
    assumptionsMade: [],
  },
};

export async function buildExampleFrNfrValidationOutput() {
  return validateGeneratedRequirements(exampleFrNfrInput);
}

export async function buildExampleAutoFixSuggestions() {
  const validation = await buildExampleFrNfrValidationOutput();
  return getAutoFixSuggestionsFromValidation(validation);
}

