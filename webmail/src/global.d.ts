/// <reference types="@solidjs/start/env" />

declare global {
  interface Window {
    __WEBMAIL_DEMO_MODE__?: boolean;
    __WEBMAIL_DEMO_STATIC_MODE__?: boolean;
  }
}

export {};
