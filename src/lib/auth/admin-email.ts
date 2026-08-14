import "server-only";

const DEFAULT_ADMIN_EMAIL = "jamescarlorivera52@gmail.com";

export async function sendPasswordHelpEmail(staffEmail: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_HELP_FROM_EMAIL;
  const adminEmail = process.env.PASSWORD_HELP_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;

  if (!apiKey || !from) {
    console.error("Password-help email is not configured. Set RESEND_API_KEY and PASSWORD_HELP_FROM_EMAIL.");
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [adminEmail],
      subject: "CJNET PhotoDesk password help request",
      text: [
        "A staff member requested help signing in to CJNET PhotoDesk.",
        "",
        `Staff email: ${staffEmail}`,
        `Requested at: ${new Date().toISOString()}`,
        "",
        "Open the Supabase Dashboard, verify the staff member, and send or set a temporary password using the approved staff-account process.",
        "Do not ask the staff member to send their old password.",
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    console.error("Password-help email delivery failed", response.status, await response.text());
    return false;
  }
  return true;
}
