export function compareDateAsc(a: string, b: string): number {
	// Expecting YYYY-MM-DD; fallback to Date if needed
	if (a === b) return 0;
	return a < b ? -1 : 1;
}

export function isValidISODate(s: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function parseToISO(dateStr: string): string | null {
	// Support ISO (YYYY-MM-DD) and US (MM/DD/YYYY)
	if (isValidISODate(dateStr)) return dateStr;
	const mdy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
	const m = dateStr.match(mdy);
	if (m) {
		const [, mm, dd, yyyy] = m;
		return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
	}
	return null;
}

export function formatTR(dateStr: string): string {
	const iso = parseToISO(dateStr);
	if (!iso) return dateStr;
	const [y, m, d] = iso.split("-").map(Number);
	const dt = new Date(Date.UTC(y, (m as number) - 1, d as number));
	return dt.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}



