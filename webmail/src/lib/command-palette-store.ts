import { createSignal } from "solid-js";

const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);

export { commandPaletteOpen };

export const openCommandPalette = () => setCommandPaletteOpen(true);
export const closeCommandPalette = () => setCommandPaletteOpen(false);
export const toggleCommandPalette = () => setCommandPaletteOpen((v) => !v);
