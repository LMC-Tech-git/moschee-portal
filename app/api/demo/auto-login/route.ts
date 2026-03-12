import { NextRequest, NextResponse } from "next/server";

const DEMO_CREDS: Record<string, { email: string; password: string }> = {
  admin:   { email: "demo-admin@moschee.app",   password: "Demo1234!" },
  teacher: { email: "demo-teacher@moschee.app", password: "Demo1234!" },
  member:  { email: "demo-member@moschee.app",  password: "Demo1234!" },
};

export async function POST(req: NextRequest) {
  const { role } = await req.json();
  const creds = DEMO_CREDS[role];
  if (!creds) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const pbUrl = process.env.POCKETBASE_URL ?? "http://127.0.0.1:8090";
  const res = await fetch(`${pbUrl}/api/collections/users/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: creds.email, password: creds.password }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Login failed" }, { status: 401 });
  }

  const data = await res.json();
  return NextResponse.json({ token: data.token, record: data.record });
}
