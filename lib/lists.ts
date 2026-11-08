// Everything a person can subscribe to by email. Today only the weekly newsletter; following a person,
// topic, business or poll will add entries here (with their own storage) and show up in admin automatically.
export type ListKind = "newsletter" | "person" | "topic" | "business" | "poll";

export type EmailList = { id: string; kind: ListKind; name: string };

export const EMAIL_LISTS: EmailList[] = [{ id: "newsletter", kind: "newsletter", name: "Weekly briefing" }];
