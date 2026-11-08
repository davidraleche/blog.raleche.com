// Everything a person can subscribe to by email. Following speakers and hosts is stored in the Follow table;
// emailing followers about new stories (and topics, businesses, polls) can add entries here.
export type ListKind = "newsletter" | "person" | "topic" | "business" | "poll";

export type EmailList = { id: string; kind: ListKind; name: string };

export const EMAIL_LISTS: EmailList[] = [{ id: "newsletter", kind: "newsletter", name: "Weekly briefing" }];
