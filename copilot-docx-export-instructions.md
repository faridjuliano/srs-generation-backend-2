# Copilot Instructions: Export Only FR and NFR to IEEE SRS DOCX Template

You are working on a TypeScript + Express.js backend for a thesis project:

**"An Automated Generation of Software Requirements Specification using Smart Template-based Approach System"**

The application stores generated SRS JSON in the database. I want to add a DOCX export feature that exports the generated Functional Requirements and Non-Functional Requirements into an IEEE-style SRS template.

---

## Main Rule

Only fill these generated sections in the IEEE SRS template:

1. Section 4: System Features / Functional Requirements
2. Section 5: Other Nonfunctional Requirements

Do not modify or auto-fill any other parts of the IEEE template.

The rest of the IEEE template must remain exactly as the original template text, including:

- Cover page
- Revision History
- Table of Contents
- 1. Introduction
- 1.1 Purpose
- 1.2 Document Conventions
- 1.3 Intended Audience and Reading Suggestions
- 1.4 Product Scope
- 1.5 References
- 2. Overall Description
- 2.1 Product Perspective
- 2.2 Product Functions
- 2.3 User Classes and Characteristics
- 2.4 Operating Environment
- 2.5 Design and Implementation Constraints
- 2.6 User Documentation
- 2.7 Assumptions and Dependencies
- 3. External Interface Requirements
- 3.1 User Interfaces
- 3.2 Hardware Interfaces
- 3.3 Software Interfaces
- 3.4 Communications Interfaces
- 6. Other Requirements
- Appendix A: Glossary
- Appendix B: Analysis Models
- Appendix C: To Be Determined List

These sections should stay as placeholder/template text unless they are manually edited in the Word template.

---

## Existing Stored JSON Structure

The backend stores the generated SRS inside:

```ts
project.generatedSrs.content
```

The useful fields are:

```ts
project.generatedSrs.content.features
project.generatedSrs.content.functionalRequirements
project.generatedSrs.content.nonFunctionalRequirements
```

Example:

```ts
{
  projectId: "47ab68bd-8fd8-40a3-820b-7f66404cb1a0",
  projectName: "Hospital Booking System",
  projectDescription: "A web-based system for booking, rescheduling, and cancelling doctor appointments.",
  generatedSrs: {
    validation: {},
    content: {
      projectName: "Hospital Booking System",
      features: [],
      functionalRequirements: [],
      nonFunctionalRequirements: {},
      constraints: [],
      assumptions: []
    },
    autoFixSuggestions: []
  }
}
```

---

## Export Behavior

The backend should:

1. Receive the full stored project JSON from the request body.
2. Validate that `project.generatedSrs.content` exists.
3. Extract only:
   - `features`
   - `functionalRequirements`
   - `nonFunctionalRequirements`
4. Map the data into a DOCX-friendly export object.
5. Load the full IEEE `.docx` template.
6. Render only the placeholders placed in Section 4 and Section 5.
7. Return the generated `.docx` file as a download.

Important:

Do not pass the raw database JSON directly into Docxtemplater.

Always use this flow:

```txt
Stored Project JSON
        ↓
FR/NFR export mapper
        ↓
Docxtemplater data object
        ↓
IEEE SRS DOCX template
        ↓
Generated DOCX file
```

---

## Required Dependencies

Use:

```bash
npm install docxtemplater pizzip
npm install -D @types/node
```

---

## Required File Structure

Create or update:

```txt
src/
  routes/
    export.routes.ts
  controllers/
    export.controller.ts
  services/
    docxExport.service.ts
  utils/
    srsExportMapper.ts
  types/
    srs.types.ts

templates/
  ieee-srs-template.docx
```

---

## Required Endpoint

Create:

```http
POST /api/export/srs
```

This endpoint receives the full stored project JSON in the request body and returns a `.docx` file.

The route should be mounted as:

```ts
app.use("/api/export", exportRoutes);
```

---

## TypeScript Interfaces

Create these interfaces in:

```txt
src/types/srs.types.ts
```

```ts
export interface StoredSrsProject {
  success?: boolean;
  projectId: string;
  projectName: string;
  projectDescription?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  generatedSrs: {
    validation?: unknown;
    content: GeneratedSrsContent;
    autoFixSuggestions?: unknown[];
  };
}

export interface GeneratedSrsContent {
  projectName: string;
  features?: Feature[];
  functionalRequirements?: FunctionalRequirement[];
  nonFunctionalRequirements?: NonFunctionalRequirements;
  constraints?: unknown[];
  assumptions?: unknown[];
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  priority: string;
  source?: string;
}

export interface FunctionalRequirement {
  id: string;
  title?: string;
  statement: string;
  priority?: string;
  category?: string;
  rationale?: string;
  fitCriterion?: string;
  verificationMethod?: string;
  preconditions?: string[];
  postconditions?: string[];
  traceToFeatures?: string[];
  traceToAssumptions?: string[];
  traceToConstraints?: string[];
  dependsOn?: string[];
  conflictsWith?: string[];
  source?: string[];
  notes?: string;
}

export interface NonFunctionalRequirement {
  id: string;
  title?: string;
  statement: string;
  priority?: string;
  rationale?: string;
  fitCriterion?: string;
  verificationMethod?: string;
  traceToFeatures?: string[];
  traceToAssumptions?: string[];
  traceToConstraints?: string[];
  source?: string[];
  notes?: string;
}

export interface NonFunctionalRequirements {
  performanceRequirements?: NonFunctionalRequirement[];
  safetyRequirements?: NonFunctionalRequirement[];
  securityRequirements?: NonFunctionalRequirement[];
  usabilityRequirements?: NonFunctionalRequirement[];
  reliabilityRequirements?: NonFunctionalRequirement[];
  availabilityRequirements?: NonFunctionalRequirement[];
  maintainabilityRequirements?: NonFunctionalRequirement[];
  portabilityRequirements?: NonFunctionalRequirement[];
  accessibilityRequirements?: NonFunctionalRequirement[];
  auditabilityRequirements?: NonFunctionalRequirement[];
  scalabilityRequirements?: NonFunctionalRequirement[];
  complianceRequirements?: NonFunctionalRequirement[];
  backupRecoveryRequirements?: NonFunctionalRequirement[];
}

export interface ExportFeature {
  number: string;
  id: string;
  name: string;
  description: string;
  priority: string;
  relatedFunctionalRequirements: FunctionalRequirement[];
}

export interface SrsFrNfrExportData {
  features: ExportFeature[];

  performanceRequirements: NonFunctionalRequirement[];
  safetyRequirements: NonFunctionalRequirement[];
  securityRequirements: NonFunctionalRequirement[];
  usabilityRequirements: NonFunctionalRequirement[];
  reliabilityRequirements: NonFunctionalRequirement[];
  availabilityRequirements: NonFunctionalRequirement[];
  maintainabilityRequirements: NonFunctionalRequirement[];
  portabilityRequirements: NonFunctionalRequirement[];
  accessibilityRequirements: NonFunctionalRequirement[];
  auditabilityRequirements: NonFunctionalRequirement[];
  scalabilityRequirements: NonFunctionalRequirement[];
  complianceRequirements: NonFunctionalRequirement[];
  backupRecoveryRequirements: NonFunctionalRequirement[];
}
```

---

## Mapper

Create:

```txt
src/utils/srsExportMapper.ts
```

Implement:

```ts
import {
  StoredSrsProject,
  SrsFrNfrExportData,
} from "../types/srs.types";

export function mapStoredProjectToFrNfrExportData(
  project: StoredSrsProject
): SrsFrNfrExportData {
  const content = project.generatedSrs.content;

  const functionalRequirements = content.functionalRequirements || [];
  const nonFunctionalRequirements = content.nonFunctionalRequirements || {};
  const features = content.features || [];

  return {
    features: features.map((feature, index) => ({
      number: `4.${index + 1}`,
      id: feature.id,
      name: feature.name,
      description: feature.description,
      priority: feature.priority,
      relatedFunctionalRequirements: functionalRequirements.filter((fr) =>
        fr.traceToFeatures?.includes(feature.id)
      ),
    })),

    performanceRequirements:
      nonFunctionalRequirements.performanceRequirements || [],

    safetyRequirements:
      nonFunctionalRequirements.safetyRequirements || [],

    securityRequirements:
      nonFunctionalRequirements.securityRequirements || [],

    usabilityRequirements:
      nonFunctionalRequirements.usabilityRequirements || [],

    reliabilityRequirements:
      nonFunctionalRequirements.reliabilityRequirements || [],

    availabilityRequirements:
      nonFunctionalRequirements.availabilityRequirements || [],

    maintainabilityRequirements:
      nonFunctionalRequirements.maintainabilityRequirements || [],

    portabilityRequirements:
      nonFunctionalRequirements.portabilityRequirements || [],

    accessibilityRequirements:
      nonFunctionalRequirements.accessibilityRequirements || [],

    auditabilityRequirements:
      nonFunctionalRequirements.auditabilityRequirements || [],

    scalabilityRequirements:
      nonFunctionalRequirements.scalabilityRequirements || [],

    complianceRequirements:
      nonFunctionalRequirements.complianceRequirements || [],

    backupRecoveryRequirements:
      nonFunctionalRequirements.backupRecoveryRequirements || [],
  };
}
```

---

## DOCX Export Service

Create:

```txt
src/services/docxExport.service.ts
```

Implement:

```ts
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { SrsFrNfrExportData } from "../types/srs.types";

export function generateSrsDocx(data: SrsFrNfrExportData): Buffer {
  const templatePath = path.resolve(
    process.cwd(),
    "templates",
    "ieee-srs-template.docx"
  );

  // The DOCX file is loaded as binary because a DOCX is a zipped XML-based file.
  const content = fs.readFileSync(templatePath, "binary");

  const zip = new PizZip(content);

  // Docxtemplater replaces only placeholders that exist in the Word template.
  // Therefore, if placeholders are only added in Section 4 and Section 5,
  // the rest of the IEEE template remains unchanged.
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(data);

  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
}
```

---

## Controller

Create:

```txt
src/controllers/export.controller.ts
```

Implement:

```ts
import { Request, Response } from "express";
import { generateSrsDocx } from "../services/docxExport.service";
import { mapStoredProjectToFrNfrExportData } from "../utils/srsExportMapper";
import { StoredSrsProject } from "../types/srs.types";

function createSafeFileName(name: string): string {
  return name
    .replace(/[^a-z0-9_\- ]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export async function exportSrsDocx(req: Request, res: Response) {
  try {
    const project = req.body as StoredSrsProject;

    if (!project?.generatedSrs?.content) {
      return res.status(400).json({
        message: "Invalid request body. Missing generatedSrs.content.",
      });
    }

    const exportData = mapStoredProjectToFrNfrExportData(project);

    const buffer = generateSrsDocx(exportData);

    const safeFileName = createSafeFileName(
      project.projectName ||
        project.generatedSrs.content.projectName ||
        "srs-document"
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFileName}.docx"`
    );

    return res.send(buffer);
  } catch (error) {
    console.error("DOCX export error:", error);

    return res.status(500).json({
      message: "Failed to export SRS document",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
```

---

## Route

Create:

```txt
src/routes/export.routes.ts
```

```ts
import { Router } from "express";
import { exportSrsDocx } from "../controllers/export.controller";

const router = Router();

router.post("/srs", exportSrsDocx);

export default router;
```

Mount it in the main Express app:

```ts
import exportRoutes from "./routes/export.routes";

app.use("/api/export", exportRoutes);
```

---

## Word Template Editing Rules

Use the existing IEEE SRS Word template.

Convert it from `.doc` to `.docx` first if needed.

Only edit Section 4 and Section 5 in the Word template.

Do not place Docxtemplater placeholders in other sections.

This is important because Docxtemplater only changes text where placeholders exist.

Therefore:

```txt
No placeholder = original template text remains unchanged
Placeholder = replaced by JSON data
```

---

## Section 4 Placeholder Content

Replace the body of Section 4 with this:

```txt
4. System Features

{#features}
{number} {name}

Description and Priority:
{description}
Priority: {priority}

Functional Requirements:
{#relatedFunctionalRequirements}
{id}: {statement}

Title: {title}
Priority: {priority}
Category: {category}
Rationale: {rationale}
Fit Criterion: {fitCriterion}
Verification Method: {verificationMethod}

Preconditions:
{#preconditions}
- {.}
{/preconditions}

Postconditions:
{#postconditions}
- {.}
{/postconditions}

Trace To Features:
{#traceToFeatures}
- {.}
{/traceToFeatures}

Trace To Assumptions:
{#traceToAssumptions}
- {.}
{/traceToAssumptions}

Trace To Constraints:
{#traceToConstraints}
- {.}
{/traceToConstraints}

{/relatedFunctionalRequirements}

{/features}
```

---

## Section 5 Placeholder Content

Replace the body of Section 5 with this:

```txt
5. Other Nonfunctional Requirements

5.1 Performance Requirements

{#performanceRequirements}
{id}: {statement}

Title: {title}
Priority: {priority}
Rationale: {rationale}
Fit Criterion: {fitCriterion}
Verification Method: {verificationMethod}
{/performanceRequirements}

5.2 Safety Requirements

{safetyRequirements}
{id}: {statement}

Title: {title}
Priority: {priority}
Rationale: {rationale}
Fit Criterion: {fitCriterion}
Verification Method: {verificationMethod}
{/safetyRequirements}

5.3 Security Requirements

{#securityRequirements}
{id}: {statement}

Title: {title}
Priority: {priority}
Rationale: {rationale}
Fit Criterion: {fitCriterion}
Verification Method: {verificationMethod}
{/securityRequirements}

5.4 Software Quality Attributes

Usability Requirements:
{#usabilityRequirements}
{id}: {statement}
Fit Criterion: {fitCriterion}
Verification Method: {verificationMethod}
{/usabilityRequirements}

Reliability Requirements:
{#reliabilityRequirements}
{id}: {statement}
Fit Criterion: {fitCriterion}
Verification Method: {verificationMethod}
{/reliabilityRequirements}

Availability Requirements:
{#availabilityRequirements}
{id}: {statement}
Fit Criterion: {fitCriterion}
Verification Method: {verificationMethod}
{/availabilityRequirements}

Maintainability Requirements:
{#maintainabilityRequirements}
{id}: {statement}
Fit Criterion: {fitCriterion}
Verification Method: {verificationMethod}
{/maintainabilityRequirements}

Portability Requirements:
{#portabilityRequirements}
{id}: {statement}
Fit Criterion: {fitCriterion}
Verification Method: {verificationMethod}
{/portabilityRequirements}

Accessibility Requirements:
{#accessibilityRequirements}
{id}: {statement}
Fit Criterion: {fitCriterion}
Verification Method: {verificationMethod}
{/accessibilityRequirements}

Scalability Requirements:
{#scalabilityRequirements}
{id}: {statement}
Fit Criterion: {fitCriterion}
Verification Method: {verificationMethod}
{/scalabilityRequirements}

Compliance Requirements:
{#complianceRequirements}
{id}: {statement}
Fit Criterion: {fitCriterion}
Verification Method: {verificationMethod}
{/complianceRequirements}

Backup and Recovery Requirements:
{#backupRecoveryRequirements}
{id}: {statement}
Fit Criterion: {fitCriterion}
Verification Method: {verificationMethod}
{/backupRecoveryRequirements}

5.5 Business Rules

<Keep this section unchanged unless business rules are generated later.>
```

Note: Make sure every Docxtemplater loop starts with `{#arrayName}` and ends with `{/arrayName}`.

---

## Important Implementation Notes

- Do not fill project name, purpose, product scope, glossary, assumptions, constraints, validation summary, or appendices.
- Do not use generated validation data in the exported document for now.
- Do not alter the database schema.
- Do not manually generate `.docx` XML.
- Do not generate PDF.
- Keep the export focused only on FR and NFR.
- The generated `.docx` should preserve the original IEEE template text everywhere except Section 4 and Section 5.

---

## Expected Result

When calling:

```http
POST /api/export/srs
Content-Type: application/json
```

with the stored project JSON body, the backend should return:

```txt
hospital-booking-system.docx
```

The document should contain generated FR and NFR content in Section 4 and Section 5 only.

All other IEEE SRS template sections should remain as the original template placeholders/text.
