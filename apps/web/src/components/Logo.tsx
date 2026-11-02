/** The Kuro Trace logo (mark + name). "black" for light backgrounds, "white" for dark ones. */
const RATIO = 507 / 120; // width / height of the exported artwork

export function Logo({ tone, height = 30, alt = "Kuro Trace" }: { tone: "black" | "white"; height?: number; alt?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small, pre-sized static asset
    <img
      src={`/brand/kuro-trace-horizontal-${tone}.png`}
      alt={alt}
      width={Math.round(height * RATIO)}
      height={height}
      style={{ display: "block", height, width: "auto" }}
      decoding="async"
    />
  );
}
