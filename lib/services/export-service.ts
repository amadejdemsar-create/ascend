import { goalService } from "@/lib/services/goal-service";
import { categoryService } from "@/lib/services/category-service";
import { HORIZON_ORDER } from "@/lib/services/import-helpers";
import { formatCSV, formatMarkdown } from "@/lib/services/export-helpers";
import PDFDocument from "pdfkit";
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
} from "docx";

// Re-export helpers so consumers can import from a single module
export { formatCSV, formatMarkdown };

/**
 * Export all goals and categories as a formatted JSON string.
 */
export async function exportJSON(userId: string): Promise<string> {
  const [goals, categories] = await Promise.all([
    goalService.list(userId),
    categoryService.list(userId),
  ]);
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), goals, categories },
    null,
    2,
  );
}

/**
 * Export all goals as a CSV string with headers.
 */
export async function exportCSV(userId: string): Promise<string> {
  const goals = await goalService.list(userId);
  return formatCSV(goals as unknown as Array<Record<string, unknown>>);
}

/**
 * Export all goals as a Markdown document grouped by horizon.
 */
export async function exportMarkdown(userId: string): Promise<string> {
  const goals = await goalService.list(userId);
  return formatMarkdown(goals as unknown as Array<Record<string, unknown>>);
}

/**
 * Export goals as a formatted PDF report with progress bars.
 */
export async function exportPDF(userId: string): Promise<Buffer> {
  const [goals, categories] = await Promise.all([
    goalService.list(userId),
    categoryService.list(userId),
  ]);

  // Build category lookup for display
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Uint8Array[] = [];

    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title
    doc.font("Helvetica-Bold").fontSize(24).text("Ascend Goal Report");
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(`Exported: ${new Date().toLocaleDateString()}`);
    doc.moveDown(2);

    const goalsData = goals as unknown as Array<Record<string, unknown>>;

    for (const horizon of HORIZON_ORDER) {
      const filtered = goalsData.filter((g) => g.horizon === horizon);
      if (filtered.length === 0) continue;

      const label = horizon.charAt(0) + horizon.slice(1).toLowerCase();
      doc.font("Helvetica-Bold").fontSize(16).text(`${label} Goals`);
      doc.moveDown(0.5);

      for (const g of filtered) {
        const isCompleted = g.status === "COMPLETED";
        const checkbox = isCompleted ? "[x]" : "[ ]";
        const progress = Number(g.progress ?? 0);
        const priorityLabel = String(g.priority ?? "MEDIUM");
        const categoryName = g.categoryId
          ? categoryMap.get(String(g.categoryId))
          : null;

        // Goal title line
        doc
          .font("Helvetica")
          .fontSize(11)
          .text(
            `${checkbox} ${g.title} (${priorityLabel}) ${progress}%${categoryName ? ` [${categoryName}]` : ""}`,
            { continued: false },
          );

        // Progress bar
        const barWidth = 200;
        const barHeight = 10;
        const x = doc.x;
        const y = doc.y + 2;

        // Background bar
        doc
          .save()
          .roundedRect(x, y, barWidth, barHeight, 2)
          .fill("#E5E7EB");

        // Filled portion
        const fillWidth = (progress / 100) * barWidth;
        if (fillWidth > 0) {
          doc
            .roundedRect(x, y, Math.max(fillWidth, 4), barHeight, 2)
            .fill("#4F46E5");
        }

        doc.restore();
        doc.y = y + barHeight + 8;
      }

      doc.moveDown(1);
    }

    // Summary section
    const total = goalsData.length;
    const completed = goalsData.filter(
      (g) => g.status === "COMPLETED",
    ).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(14).text("Summary");
    doc.moveDown(0.5);
    doc
      .font("Helvetica")
      .fontSize(11)
      .text(`Total goals: ${total}`)
      .text(`Completed: ${completed}`)
      .text(`Completion rate: ${rate}%`);

    doc.end();
  });
}

/**
 * Export goals as a formatted DOCX document with headings and checkboxes.
 */
export async function exportDOCX(userId: string): Promise<Buffer> {
  const [goals, categories] = await Promise.all([
    goalService.list(userId),
    categoryService.list(userId),
  ]);

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const goalsData = goals as unknown as Array<Record<string, unknown>>;

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: "Ascend Goal Report",
      heading: HeadingLevel.TITLE,
    }),
  );

  // Date
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Exported: ${new Date().toLocaleDateString()}`,
          italics: true,
          size: 20,
        }),
      ],
    }),
  );

  children.push(new Paragraph({ text: "" }));

  for (const horizon of HORIZON_ORDER) {
    const filtered = goalsData.filter((g) => g.horizon === horizon);
    if (filtered.length === 0) continue;

    const label = horizon.charAt(0) + horizon.slice(1).toLowerCase();
    children.push(
      new Paragraph({
        text: `${label} Goals`,
        heading: HeadingLevel.HEADING_2,
      }),
    );

    for (const g of filtered) {
      const isCompleted = g.status === "COMPLETED";
      // Unicode ballot box: U+2611 (checked), U+2610 (unchecked)
      const checkbox = isCompleted ? "\u2611" : "\u2610";
      const progress = Number(g.progress ?? 0);
      const priorityLabel = String(g.priority ?? "MEDIUM");
      const categoryName = g.categoryId
        ? categoryMap.get(String(g.categoryId))
        : null;

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${checkbox} ` }),
            new TextRun({ text: String(g.title), bold: true }),
            new TextRun({
              text: ` (${priorityLabel}) ${progress}%${categoryName ? ` [${categoryName}]` : ""}`,
            }),
          ],
        }),
      );
    }

    children.push(new Paragraph({ text: "" }));
  }

  // Summary
  const total = goalsData.length;
  const completed = goalsData.filter((g) => g.status === "COMPLETED").length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  children.push(
    new Paragraph({
      text: "Summary",
      heading: HeadingLevel.HEADING_2,
    }),
  );
  children.push(new Paragraph({ text: `Total goals: ${total}` }));
  children.push(new Paragraph({ text: `Completed: ${completed}` }));
  children.push(new Paragraph({ text: `Completion rate: ${rate}%` }));

  const document = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(document);
  return Buffer.from(buffer);
}
