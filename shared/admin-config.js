export const ADMIN_EMAILS = ["in.with.imran@gmail.com"];

export const ADMIN_NAME = "Tabib Imran";

export function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.includes(email);
}

export const VERIFIED_EMAILS = ["leafmash@gmail.com"];

export const VERIFIED_NAME = "LeafMash";

export function isVerifiedEmail(email) {
  return !!email && VERIFIED_EMAILS.includes(email);
}
