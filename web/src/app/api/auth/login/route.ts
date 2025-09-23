import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const userConfig = authenticateUser(username, password);
    
    if (!userConfig) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Return user config without password for security
    const { password: _password, ...userConfigWithoutPassword } = userConfig;
    return NextResponse.json({ user: userConfigWithoutPassword });
  } catch (error) {
    console.error("/api/auth/login error", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
