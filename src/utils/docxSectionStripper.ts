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

  /**
   * Section 4: System Features
   *
   * If there are no features, remove the System Features heading.
   */
  if (exportData.features.length === 0) {
    emptySectionHeadings.add("System Features");
  }

  /**
   * Section 5: Other Nonfunctional Requirements
   *
   * In the new dynamic template, NFR categories are stored inside:
   *
   * exportData.nonFunctionalRequirementSections
   *
   * Example:
   * [
   *   {
   *     title: "Performance Requirements",
   *     requirements: [...]
   *   },
   *   {
   *     title: "Security Requirements",
   *     requirements: [...]
   *   }
   * ]
   *
   * Empty NFR categories are already filtered in srsExportMapper.
   */
  if (exportData.nonFunctionalRequirementSections.length === 0) {
    emptySectionHeadings.add("Other Nonfunctional Requirements");
  }

  let featureIndex = -1;

  return documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const paragraphText = extractParagraphText(paragraphXml).trim();

    /**
     * Remove whole section headings if the section has no data.
     */
    if (emptySectionHeadings.has(paragraphText)) {
      return "";
    }

    /**
     * Track current feature.
     *
     * This assumes your template contains:
     * Feature ID: {id}
     */
    if (paragraphText.startsWith("Feature ID:")) {
      featureIndex += 1;
      return paragraphXml;
    }

    /**
     * Remove "Functional Requirements" heading when a feature
     * has no related functional requirements.
     */
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