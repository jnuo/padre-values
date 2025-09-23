import { google } from "googleapis";

export type Metric = {
	id: string;
	name: string;
	unit: string;
	ref_min: number | null;
	ref_max: number | null;
};

export type MetricValue = {
	metric_id: string;
	date: string; // ISO yyyy-mm-dd
	value: number;
};

export type SheetsPayload = {
	metrics: Metric[];
	values: MetricValue[];
};

export type UserConfig = {
	id: string;
	name: string;
	username: string;
	password: string;
	dataSheetName: string;
	referenceSheetName: string;
};

// Load user configurations from environment variables
function getUserConfigs(): UserConfig[] {
	const usersEnv = process.env.USERS_CONFIG;
	
	if (!usersEnv) {
		throw new Error("USERS_CONFIG not found in environment variables");
	}
	
	try {
		return JSON.parse(usersEnv);
	} catch (error) {
		throw new Error("Invalid USERS_CONFIG JSON format");
	}
}

export function getAvailableUsers(): UserConfig[] {
	return getUserConfigs();
}

export function getUserConfig(userId: string): UserConfig | null {
	const users = getUserConfigs();
	return users.find(user => user.id === userId) || null;
}

export function authenticateUser(username: string, password: string): UserConfig | null {
	const users = getUserConfigs();
	return users.find(user => user.username === username && user.password === password) || null;
}

function getAuth() {
	const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
	const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
	if (!clientEmail || !privateKey) {
		throw new Error("Missing Google service account env vars");
	}
	return new google.auth.JWT({
		email: clientEmail,
		key: privateKey,
		scopes: [
			"https://www.googleapis.com/auth/spreadsheets.readonly",
		],
	});
}

export async function fetchSheetsData(spreadsheetId: string, userId: string) : Promise<SheetsPayload> {
	const userConfig = getUserConfig(userId);
	if (!userConfig) {
		throw new Error(`User with ID '${userId}' not found`);
	}

	const auth = getAuth();
	const sheets = google.sheets({ version: "v4", auth });

	const [lookerRes, refsRes] = await Promise.all([
		sheets.spreadsheets.values.get({ spreadsheetId, range: userConfig.dataSheetName }),
		sheets.spreadsheets.values.get({ spreadsheetId, range: userConfig.referenceSheetName }),
	]);

	const looker = lookerRes.data.values ?? [];
	const refs = refsRes.data.values ?? [];

	if (looker.length === 0) {
		return { metrics: [], values: [] };
	}

	const header = looker[0] as string[]; // [Date, Metric1, Metric2, ...]
	const metricNames = header.slice(1);

	// Build reference map: name -> { unit, ref_min, ref_max }
	const refMap = new Map<string, { unit: string; ref_min: number | null; ref_max: number | null }>();
	for (const row of refs.slice(1)) {
		const [name, unit, low, high] = [row[0], row[1], row[2], row[3]] as (string | undefined)[];
		if (!name) continue;
		const refMin = low !== undefined && low !== "" ? Number(low) : null;
		const refMax = high !== undefined && high !== "" ? Number(high) : null;
		refMap.set(name, { unit: unit ?? "", ref_min: isFinite(refMin as number) ? refMin : null, ref_max: isFinite(refMax as number) ? refMax : null });
	}

	// Create metrics
	const metrics: Metric[] = metricNames.map((name) => {
		const ref = refMap.get(name) ?? { unit: "", ref_min: null, ref_max: null };
		return {
			id: name,
			name,
			unit: ref.unit,
			ref_min: ref.ref_min,
			ref_max: ref.ref_max,
		};
	});

	// Parse values
	const values: MetricValue[] = [];
	for (const row of looker.slice(1)) {
		const date = (row[0] as string) ?? "";
		if (!date) continue;
		for (let i = 1; i < header.length; i++) {
			const name = header[i] as string;
			const cell = row[i] as string | undefined;
			if (cell === undefined || cell === "") continue;
			const numeric = Number(cell);
			if (!Number.isFinite(numeric)) continue;
			values.push({ metric_id: name, date, value: numeric });
		}
	}

	return { metrics, values };
}



