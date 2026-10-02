/**
 * The OttoLabs mark — the same "OL" tile as the sign-in page — as JSX for
 * `ImageResponse`, which renders a restricted subset of CSS (flexbox only, no
 * custom properties, no oklch), hence the literal hex values.
 */

/** The dark theme's background, matching `themeColor` in the root layout. */
export const BRAND_BACKGROUND = "#0b1416";
/** The dark theme's primary teal. */
const BRAND_ACCENT = "#00d5be";

export function BrandMark({
  size,
  variant,
}: {
  size: number;
  /**
   * `tile`: a rounded square on a transparent canvas, for browser tabs and
   * desktop launchers. `bleed`: the background fills the canvas edge to edge,
   * for platforms that cut their own shape (iOS, Android maskable), with the
   * letters kept inside the central safe zone.
   */
  variant: "tile" | "bleed";
}) {
  const bleed = variant === "bleed";
  // The letters are drawn as shapes, not typed: ImageResponse only ships a
  // regular-weight font, and a hairline "OL" vanishes at favicon size.
  // Maskable icons may be cropped to a circle 80% of the canvas wide; scaled
  // to 0.78 the mark sits well inside it.
  const unit = size * (bleed ? 0.78 : 1);
  const height = Math.round(unit * 0.4);
  const stroke = Math.max(3, Math.round(unit * 0.085));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: Math.round(unit * 0.06),
        background: BRAND_BACKGROUND,
        borderRadius: bleed ? 0 : Math.round(size * 0.22),
      }}
    >
      {/* O */}
      <div
        style={{
          width: Math.round(unit * 0.3),
          height,
          border: `${stroke}px solid ${BRAND_ACCENT}`,
          borderRadius: "50%",
        }}
      />
      {/* L */}
      <div
        style={{
          width: Math.round(unit * 0.21),
          height,
          borderLeft: `${stroke}px solid ${BRAND_ACCENT}`,
          borderBottom: `${stroke}px solid ${BRAND_ACCENT}`,
        }}
      />
    </div>
  );
}
