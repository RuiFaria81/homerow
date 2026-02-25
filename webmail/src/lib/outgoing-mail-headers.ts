export interface OutgoingListUnsubscribeHeaders {
  "List-Unsubscribe": string;
  "List-Unsubscribe-Post": string;
}

function sanitizeHeaderMailbox(value: string): string {
  return value.replace(/[\r\n<>]/g, "").trim();
}

export function buildListUnsubscribeHeaders(senderEmail: string): OutgoingListUnsubscribeHeaders {
  const mailbox = sanitizeHeaderMailbox(senderEmail);
  return {
    "List-Unsubscribe": `<mailto:${mailbox}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
