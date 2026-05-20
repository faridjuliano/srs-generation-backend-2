import test from 'node:test';
import assert from 'node:assert/strict';
import { stripEmptySectionParagraphs } from '../utils/docxSectionStripper';

test('removes empty section headings but keeps TOC-like entries', () => {
  const xml = [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    '<w:body>',
    '<w:p><w:r><w:t>4.System Features4</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>System Features</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Feature ID: feat-1</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Functional Requirements</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Other Nonfunctional Requirements</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Performance Requirements</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Security Requirements</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Software Quality Attributes</w:t></w:r></w:p>',
    '</w:body>',
    '</w:document>',
  ].join('');

  const output = stripEmptySectionParagraphs(xml, {
    features: [
      {
        number: '4.1',
        id: 'feat-1',
        name: 'Login',
        description: 'Allow sign in',
        priority: 'High',
        relatedFunctionalRequirements: [],
      },
    ],
    performanceRequirements: [],
    safetyRequirements: [],
    securityRequirements: [],
    usabilityRequirements: [],
    reliabilityRequirements: [],
    availabilityRequirements: [],
    maintainabilityRequirements: [],
    portabilityRequirements: [],
    accessibilityRequirements: [],
    auditabilityRequirements: [],
    scalabilityRequirements: [],
    complianceRequirements: [],
    backupRecoveryRequirements: [],
  });

  assert.ok(output.includes('4.System Features4'));
  assert.ok(output.includes('<w:t>System Features</w:t>'));
  assert.ok(!output.includes('<w:t>Other Nonfunctional Requirements</w:t>'));
  assert.ok(!output.includes('<w:t>Performance Requirements</w:t>'));
  assert.ok(!output.includes('<w:t>Security Requirements</w:t>'));
  assert.ok(!output.includes('<w:t>Software Quality Attributes</w:t>'));
  assert.ok(output.includes('<w:t>Feature ID: feat-1</w:t>'));
  assert.ok(!output.includes('<w:t>Functional Requirements</w:t>'));
});

test('removes the System Features heading when there are no features', () => {
  const xml = [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    '<w:body>',
    '<w:p><w:r><w:t>System Features</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Other Nonfunctional Requirements</w:t></w:r></w:p>',
    '</w:body>',
    '</w:document>',
  ].join('');

  const output = stripEmptySectionParagraphs(xml, {
    features: [],
    performanceRequirements: [],
    safetyRequirements: [],
    securityRequirements: [],
    usabilityRequirements: [],
    reliabilityRequirements: [],
    availabilityRequirements: [],
    maintainabilityRequirements: [],
    portabilityRequirements: [],
    accessibilityRequirements: [],
    auditabilityRequirements: [],
    scalabilityRequirements: [],
    complianceRequirements: [],
    backupRecoveryRequirements: [],
  });

  assert.ok(!output.includes('<w:t>System Features</w:t>'));
  assert.ok(!output.includes('<w:t>Other Nonfunctional Requirements</w:t>'));
});
