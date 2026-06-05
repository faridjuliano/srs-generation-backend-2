import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { SrsFrNfrExportData } from "../types/srs.types";
import { stripEmptySectionsFromDocxBuffer } from "../utils/docxSectionStripper";

export function generateSrsDocx(data: SrsFrNfrExportData): Buffer {

  let templatePath: string;

  if (process.env.ENVIRONMENT === "production") {
    templatePath = path.resolve(
      __dirname,
      "..",
      "templates",
      "ieee-srs-template.docx"
    );
  } else {
    templatePath = path.resolve(
      process.cwd(),
      "src",
      "templates",
      "ieee-srs-template.docx"
    );
  }

  // Validate template exists and is a .docx file
  if (!fs.existsSync(templatePath)) {
    throw new Error(`DOCX template not found at ${templatePath}`);
  }

  if (path.extname(templatePath).toLowerCase() !== ".docx") {
    throw new Error("DOCX template must have a .docx extension");
  }

  // Read the DOCX file as a Buffer (PizZip works reliably with Buffer/Uint8Array)
  const content = fs.readFileSync(templatePath);

  const zip = new PizZip(content);

  // Docxtemplater replaces only placeholders that exist in the Word template.
  // Therefore, if placeholders are only added in Section 4 and Section 5,
  // the rest of the IEEE template remains unchanged.
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  try {
    // Render the template using the mapped data object.
    // Docxtemplater may throw if the template placeholders are malformed.
    doc.render(data as any);
  } catch (err) {
    // Attach additional context and rethrow so controller can log/return it.
    const errorMessage =
      err instanceof Error ? err.message : JSON.stringify(err);
    throw new Error(`Docxtemplater render error: ${errorMessage}`);
  }

  const generated = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  if (!Buffer.isBuffer(generated)) {
    throw new Error("Failed to generate DOCX buffer");
  }

  return stripEmptySectionsFromDocxBuffer(generated as Buffer, data);
}
