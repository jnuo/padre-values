import { NextResponse } from "next/server";
import { fetchSheetsData } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
		if (!spreadsheetId) {
			return NextResponse.json({ error: "Missing GOOGLE_SHEETS_SPREADSHEET_ID" }, { status: 500 });
		}
		const data = await fetchSheetsData(spreadsheetId);
		return NextResponse.json(data);
	} catch (error) {
		console.error("/api/data error", error);
		return NextResponse.json({ error: "Failed to fetch sheets" }, { status: 500 });
	}
}



