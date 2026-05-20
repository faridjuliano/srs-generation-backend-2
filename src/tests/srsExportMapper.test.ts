import test from 'node:test';
import assert from 'node:assert/strict';
import { mapStoredProjectToFrNfrExportData } from '../utils/srsExportMapper';

test('removes empty feature and requirement objects from export data', () => {
  const mapped = mapStoredProjectToFrNfrExportData({
    projectId: 'project-1',
    projectName: 'Test Project',
    generatedSrs: {
      content: {
        projectName: 'Test Project',
        features: [
          {} as never,
          {
            id: 'feat-1',
            name: 'Login',
            description: 'Allow user sign in',
            priority: 'High',
          },
        ],
        functionalRequirements: [
          {} as never,
          {
            id: 'fr-1',
            statement: 'System shall allow sign in.',
            preconditions: ['  ', 'User has account'],
            postconditions: ['', 'Session created'],
            traceToFeatures: ['feat-1', ''],
            traceToAssumptions: [''],
            traceToConstraints: [],
            dependsOn: ['dep-1', '   '],
            conflictsWith: [''],
            source: [' source-1 '],
          },
        ],
        nonFunctionalRequirements: {
          performanceRequirements: [
            {} as never,
            {
              id: 'nfr-1',
              statement: 'System shall load fast.',
              traceToFeatures: ['feat-1', ''],
              source: ['   ', 'source-2'],
            },
          ],
          safetyRequirements: [{} as never],
        },
      },
    },
  });

  assert.equal(mapped.features.length, 1);
  assert.equal(mapped.features[0].id, 'feat-1');
  assert.equal(mapped.features[0].relatedFunctionalRequirements.length, 1);
  assert.equal(mapped.features[0].relatedFunctionalRequirements[0].id, 'fr-1');
  assert.deepEqual(mapped.features[0].relatedFunctionalRequirements[0].preconditions, ['User has account']);
  assert.deepEqual(mapped.features[0].relatedFunctionalRequirements[0].postconditions, ['Session created']);
  assert.deepEqual(mapped.features[0].relatedFunctionalRequirements[0].traceToFeatures, ['feat-1']);
  assert.deepEqual(mapped.features[0].relatedFunctionalRequirements[0].dependsOn, ['dep-1']);
  assert.deepEqual(mapped.features[0].relatedFunctionalRequirements[0].source, ['source-1']);

  assert.equal(mapped.performanceRequirements.length, 1);
  assert.equal(mapped.performanceRequirements[0].id, 'nfr-1');
  assert.deepEqual(mapped.performanceRequirements[0].traceToFeatures, ['feat-1']);
  assert.deepEqual(mapped.performanceRequirements[0].source, ['source-2']);

  assert.equal(mapped.safetyRequirements.length, 0);
});
