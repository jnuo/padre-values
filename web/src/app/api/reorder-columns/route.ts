import { NextResponse } from "next/server";
import { reorderSheetColumns } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { userId, newMetricOrder } = body;

		if (!userId || !Array.isArray(newMetricOrder)) {
			return NextResponse.json(
				{ error: "Missing or invalid userId or newMetricOrder" },
				{ status: 400 }
			);
		}

		const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
		if (!spreadsheetId) {
			return NextResponse.json(
				{ error: "Missing GOOGLE_SHEETS_SPREADSHEET_ID" },
				{ status: 500 }
			);
		}

		await reorderSheetColumns(spreadsheetId, userId, newMetricOrder);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("/api/reorder-columns error", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Failed to reorder columns" },
			{ status: 500 }
		);
	}
}
