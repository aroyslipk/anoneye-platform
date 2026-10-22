import type { SVGProps } from "react";

/** Simple line glyphs used to label platform selection (not Anoneye branding). */
export function InstagramGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.6 8.2h-1.3c-1.1 0-1.8.7-1.8 1.9v1.3h-1.4v2h1.4V18h2.1v-4.6h1.6l.3-2h-1.9v-1c0-.4.2-.6.7-.6h1.3V8.2Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ProviderGlyph({ platform, ...props }: SVGProps<SVGSVGElement> & { platform: "instagram" | "facebook" }) {
  return platform === "instagram" ? <InstagramGlyph {...props} /> : <FacebookGlyph {...props} />;
}
