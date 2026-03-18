import { cookies } from "next/headers";

interface AuthCookieResult {
  isLoggedIn: boolean;
  /** true nur wenn eingeloggt UND status === "active" */
  isActiveMember: boolean;
  userId: string;
}

/**
 * Liest den pb_auth-Cookie und prüft ob der User eingeloggt und aktiv ist.
 * Pending-User sind eingeloggt, aber NICHT active → isActiveMember = false.
 */
export function getAuthFromCookie(): AuthCookieResult {
  const cookieStore = cookies();
  const authCookie = cookieStore.get("pb_auth");

  if (!authCookie?.value) {
    return { isLoggedIn: false, isActiveMember: false, userId: "" };
  }

  try {
    const parsed = JSON.parse(authCookie.value);
    const model = parsed?.model;
    const userId = model?.id || "";
    const status = model?.status;
    return {
      isLoggedIn: !!userId,
      isActiveMember: status === "active",
      userId,
    };
  } catch {
    return { isLoggedIn: false, isActiveMember: false, userId: "" };
  }
}
