// Users who should automatically receive free access when signing up
export const FREE_ACCESS_EMAILS: string[] = [
  "neerajk1208@gmail.com",
];

export function shouldHaveFreeAccess(email: string): boolean {
  return FREE_ACCESS_EMAILS.includes(email.toLowerCase());
}
