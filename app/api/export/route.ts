import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import {
  exportJSON,
  exportCSV,
  exportMarkdown,
  exportPDF,
  exportDOCX,
} from "@/lib/services/export-service";

const FORMAT_CONFIG: Record<
  string,
  {
    fn: (userId: string) => Promise<string | Buffer>;
    contentType: string;
    filename: string;
  }
> = {
  json: {
    fn: exportJSON,
    contentType: "application/json",
    filename: "ascend-export.json",
  },
  csv: {
    fn: exportCSV,
    contentType: "text/csv",
    filename: "ascend-export.csv",
  },
  markdown: {
    fn: exportMarkdown,
    contentType: "text/markdown",
    filename: "ascend-export.md",
  },
  pdf: {
    fn: exportPDF,
    contentType: "application/pdf",
    filename: "ascend-report.pdf",
  },
  docx: {
    fn: exportDOCX,
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    filename: "ascend-report.docx",
  },
};

export async function GET(request: NextRequest) {
  try {
    const auth = await validateApiKey(request);
    if (!auth.success) return unauthorizedResponse();

    const format = request.nextUrl.searchParams.get("format") ?? "json";
    const config = FORMAT_CONFIG[format];

    if (!config) {
      return NextResponse.json(
        {
          error:
            "Invalid format. Supported: json, csv, markdown, pdf, docx",
        },
        { status: 400 },
      );
    }

    const data = await config.fn(auth.userId);
    const body = typeof data === "string" ? data : new Uint8Array(data);

    return new NextResponse(body, {
      headers: {
        "Content-Type": config.contentType,
        "Content-Disposition": `attachment; filename="${config.filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
