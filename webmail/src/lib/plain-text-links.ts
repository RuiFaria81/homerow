function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function splitTrailingPunctuation(value: string): { url: string; trailing: string } {
  let url = value;
  let trailing = "";
  while (/[),.!?;:]$/.test(url)) {
    trailing = `${url.slice(-1)}${trailing}`;
    url = url.slice(0, -1);
  }
  return { url, trailing };
}

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

export function linkifyPlainText(text: string | null | undefined): string {
  const input = text || "";
  let output = "";
  let lastIndex = 0;

  for (const match of input.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    const matched = match[0];
    output += escapeHtml(input.slice(lastIndex, index));

    const { url, trailing } = splitTrailingPunctuation(matched);
    const normalizedHref =
      url.toLowerCase().startsWith("http://") || url.toLowerCase().startsWith("https://")
        ? url
        : `https://${url}`;

    output += `<a href="${escapeHtmlAttribute(normalizedHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>${escapeHtml(trailing)}`;
    lastIndex = index + matched.length;
  }

  output += escapeHtml(input.slice(lastIndex));
  return output;
}
