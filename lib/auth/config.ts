export const FIREBASE_SESSION_COOKIE = "ejc_sim_session";
export const DEMO_SESSION_COOKIE = "ejc_sim_demo";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export function getStudentDomains(): string[] {
  return (process.env.NEXT_PUBLIC_STUDENT_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

export function getInitialAdminEmails(): string[] {
  return (process.env.INITIAL_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
