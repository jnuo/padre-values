import { NextResponse } from "next/server";
import { fetchSheetsData } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const userId = searchParams.get('userId');
		
		if (!userId) {
			return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
		}

		const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
		if (!spreadsheetId) {
			return NextResponse.json({ error: "Missing GOOGLE_SHEETS_SPREADSHEET_ID" }, { status: 500 });
		}
		
		const data = await fetchSheetsData(spreadsheetId, userId);
		return NextResponse.json(data);
	} catch (error) {
		console.error("/api/data error", error);
		return NextResponse.json({ error: "Failed to fetch sheets" }, { status: 500 });
	}
}



