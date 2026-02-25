import type { JSX } from "solid-js";

interface IconProps {
  size?: number;
  class?: string;
  strokeWidth?: number;
}

const defaults = (props: IconProps) => ({
  size: props.size ?? 20,
  strokeWidth: props.strokeWidth ?? 1.75,
  class: props.class ?? "",
});

export function IconInbox(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

export function IconEnvelope(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

export function IconEnvelopeOpen(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z" />
      <path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10" />
    </svg>
  );
}

export function IconSend(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

export function IconSendClock(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="m21 3-6.5 18-3.8-8-8-3.8Z" />
      <path d="M21 3 10.7 13.3" />
      <circle cx="18" cy="18" r="4" />
      <path d="M18 16.5V18l1.1 1.1" />
    </svg>
  );
}

export function IconTrash(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function IconSearch(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function IconCompose(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M12 20h9" />
      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
    </svg>
  );
}

export function IconStar(props: IconProps & { filled?: boolean }): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill={props.filled ? "currentColor" : "none"} stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function IconImportant(props: IconProps & { filled?: boolean }): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill={props.filled ? "currentColor" : "none"} stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <polygon points="3 4 12 12 3 20 12 20 21 12 12 4" />
    </svg>
  );
}

export function IconArchive(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

export function IconSpam(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function IconRefresh(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

export function IconBack(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

export function IconClose(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function IconMail(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function IconSettings(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconSlidersHorizontal(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

export function IconHelp(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function IconGithub(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M9 19c-4.5 1.5-4.5-2.5-6-3m12 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.2-1.5 6.2-6.8a5.2 5.2 0 0 0-1.4-3.6 4.9 4.9 0 0 0-.1-3.6s-1.1-.3-3.8 1.4a13.4 13.4 0 0 0-7 0C5.2 1.2 4 1.5 4 1.5a4.9 4.9 0 0 0-.1 3.6 5.2 5.2 0 0 0-1.4 3.6c0 5.3 3.2 6.5 6.2 6.8a3.4 3.4 0 0 0-.9 2.6V22" />
    </svg>
  );
}

export function IconClock(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function IconInfo(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="10" x2="12" y2="16" />
      <circle cx="12" cy="7" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function IconSparkles(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M12 3l1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3L7.5 7.5l3.3-1.2Z" />
      <path d="M19 12l.7 1.8 1.8.7-1.8.7L19 17l-.7-1.8-1.8-.7 1.8-.7Z" />
      <path d="M6 14l.9 2.1L9 17l-2.1.9L6 20l-.9-2.1L3 17l2.1-.9Z" />
    </svg>
  );
}

export function IconBriefcase(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}

export function IconCart(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <circle cx="9" cy="20" r="1.3" />
      <circle cx="18" cy="20" r="1.3" />
      <path d="M2 3h2l2.4 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 7H6" />
    </svg>
  );
}

export function IconReceipt(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M4 3v18l2-1.5L8 21l2-1.5L12 21l2-1.5 2 1.5 2-1.5 2 1.5V3z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

export function IconHeart(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M20.8 8.6a5 5 0 0 0-8.1-3.3L12 6l-.7-.7a5 5 0 0 0-8.1 3.3c0 2.2 1 4.2 2.7 5.6L12 20l6.1-5.8a7.5 7.5 0 0 0 2.7-5.6z" />
    </svg>
  );
}

export function IconCode(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="m8 9-4 3 4 3" />
      <path d="m16 9 4 3-4 3" />
      <path d="m14 4-4 16" />
    </svg>
  );
}

export function IconBolt(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
    </svg>
  );
}

export function IconPaperclip(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

export function IconLink(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function IconSmile(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

export function IconReply(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M9 15 3 9l6-6" />
      <path d="M3 9h12a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

export function IconReplyAll(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M7 17l-5-5 5-5" />
      <path d="M2 12h13a8 8 0 0 1 0 16h-3" />
      <polyline points="13 7 13 17" />
      <path d="M12 7l5-5 5 5" style={{ display: "none" }} />
      <polyline points="7 17 2 12 7 7" />
      <polyline points="12 17 7 12 12 7" />
      <path d="M22 18v-2a4 4 0 0 0-4-4H7" />
    </svg>
  );
}

export function IconForward(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="m15 15 6-6-6-6" />
      <path d="M21 9H9a6 6 0 0 0 0 12h3" />
    </svg>
  );
}

export function IconMaximize(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

export function IconMinimize(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

export function IconWindowMinimize(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconPlus(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

export function IconLabel(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}

export function IconCategories(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <rect x="3" y="4" width="8" height="6" rx="1.4" />
      <rect x="13" y="4" width="8" height="6" rx="1.4" />
      <rect x="3" y="14" width="8" height="6" rx="1.4" />
      <rect x="13" y="14" width="8" height="6" rx="1.4" />
    </svg>
  );
}

export function IconMoon(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function IconSun(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" /><path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" /><path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

export function IconChevronUp(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export function IconChevronDown(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconChevronLeft(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function IconCheck(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconLayout(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

export function IconPopOut(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function IconEdit(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function IconPalette(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  );
}

export function IconDrag(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="9" cy="5" r="1" fill="currentColor" />
      <circle cx="9" cy="19" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="5" r="1" fill="currentColor" />
      <circle cx="15" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconDrafts(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function IconFolder(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

export function IconImport(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M12 2v10" />
      <path d="m8 8 4 4 4-4" />
      <path d="M20 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5" />
      <path d="M4 16h5l1.5 2h3L15 16h5" />
    </svg>
  );
}

export function IconUsers(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconExpand(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

export function IconCollapse(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M4 14h6v6" />
      <path d="M20 10h-6V4" />
      <path d="M14 10l7-7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

export function IconSignature(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <path d="M2 17c1.5-1.5 3-2 5-2s3 1.5 5 0 2-2.5 4-2.5 3 1 4.5 2.5" />
      <path d="M2 21h20" />
    </svg>
  );
}

export function IconBlock(props: IconProps): JSX.Element {
  const d = defaults(props);
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={d.strokeWidth} stroke-linecap="round" stroke-linejoin="round" class={d.class}>
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}
