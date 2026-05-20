import PizZip from "pizzip";
import { SrsFrNfrExportData } from "../types/srs.types";

function extractParagraphText(paragraphXml: string): string {
  const texts: string[] = [];
  const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;

  while ((match = textRegex.exec(paragraphXml)) !== null) {
    texts.push(match[1]);
  }

  return texts.join("");
}

export function stripEmptySectionParagraphs(
  documentXml: string,
  exportData: SrsFrNfrExportData
): string {
  const emptySectionHeadings = new Set<string>();

  if (exportData.features.length === 0) {
    emptySectionHeadings.add("System Features");
  }

  const qualityAttributeCounts = [
    exportData.usabilityRequirements.length,
    exportData.reliabilityRequirements.length,
    exportData.availabilityRequirements.length,
    exportData.maintainabilityRequirements.length,
    exportData.portabilityRequirements.length,
    exportData.accessibilityRequirements.length,
    exportData.auditabilityRequirements.length,
    exportData.scalabilityRequirements.length,
    exportData.complianceRequirements.length,
    exportData.backupRecoveryRequirements.length,
  ];

  const nfrSections = [
    ["Performance Requirements", exportData.performanceRequirements.length],
    ["Safety Requirements", exportData.safetyRequirements.length],
    ["Security Requirements", exportData.securityRequirements.length],
    ["Usability Requirements:", exportData.usabilityRequirements.length],
    ["Reliability Requirements:", exportData.reliabilityRequirements.length],
    ["Availability Requirements:", exportData.availabilityRequirements.length],
    ["Maintainability Requirements:", exportData.maintainabilityRequirements.length],
    ["Portability Requirements:", exportData.portabilityRequirements.length],
    ["Accessibility Requirements:", exportData.accessibilityRequirements.length],
    ["Auditability Requirements:", exportData.auditabilityRequirements.length],
    ["Scalability Requirements:", exportData.scalabilityRequirements.length],
    ["Compliance Requirements:", exportData.complianceRequirements.length],
    ["Backup and Recovery Requirements:", exportData.backupRecoveryRequirements.length],
  ] as const;

  if (qualityAttributeCounts.every((count) => count === 0)) {
    emptySectionHeadings.add("Software Quality Attributes");
  }

  if ([
    exportData.performanceRequirements.length,
    exportData.safetyRequirements.length,
    exportData.securityRequirements.length,
    ...qualityAttributeCounts,
  ].every((count) => count === 0)) {
    emptySectionHeadings.add("Other Nonfunctional Requirements");
  }

  for (const [heading, count] of nfrSections) {
    if (count === 0) {
      emptySectionHeadings.add(heading);
    }
  }

  let featureIndex = -1;

  return documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const paragraphText = extractParagraphText(paragraphXml).trim();

    if (emptySectionHeadings.has(paragraphText)) {
      return "";
    }

    if (paragraphText.startsWith("Feature ID:")) {
      featureIndex += 1;
      return paragraphXml;
    }

    if (paragraphText === "Functional Requirements") {
      const feature = exportData.features[featureIndex];
      if (feature && feature.relatedFunctionalRequirements.length === 0) {
        return "";
      }
    }

    return paragraphXml;
  });
}

export function stripEmptySectionsFromDocxBuffer(
  buffer: Buffer,
  exportData: SrsFrNfrExportData
): Buffer {
  const zip = new PizZip(buffer);
  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    return buffer;
  }

  const updatedXml = stripEmptySectionParagraphs(
    documentFile.asText(),
    exportData
  );

  zip.file("word/document.xml", updatedXml);

  return zip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;
}
