export {};

declare global {
  interface Window {
    supercool?: {
      track: (event: string, props?: Record<string, unknown>) => void;
    };
  }
}
