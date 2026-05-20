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

    // DEBUG: Log the mapped export data so you can verify values match template placeholders
    console.debug("SRS export data:", JSON.stringify(exportData, null, 2));

    const buffer = generateSrsDocx(exportData);

    const safeFileName = createSafeFileName(
      project.projectName ||
        project.generatedSrs.content.projectName ||
        "srs-document"
    );

    // Ensure filename ends with .docx
    const filename = safeFileName.endsWith(".docx")
      ? safeFileName
      : `${safeFileName}.docx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    if (!Buffer.isBuffer(buffer)) {
      console.error("DOCX export did not produce a buffer");
      return res.status(500).json({ message: "Failed to generate DOCX file" });
    }

    return res.send(buffer);
  } catch (error) {
    console.error("DOCX export error:", error);

    return res.status(500).json({
      message: "Failed to export SRS document",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
