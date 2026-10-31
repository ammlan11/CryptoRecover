/**
 * The animated "trace network" graphic: dotted rings turning at different speeds,
 * a scanning arc, trace lines flowing out to report nodes, a pulsing core and one
 * flagged node. Pure SVG + CSS (classes in globals.css), so it costs nothing to load
 * and stops for visitors who ask for reduced motion. Decorative, hidden from screen readers.
 */
export function HeroOrb() {
  return (
    <svg viewBox="0 0 520 520" aria-hidden="true" focusable="false" style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
      <g fill="none" stroke="#3fd0e6" strokeLinecap="round">
        <circle className="spin" cx="260" cy="260" r="244" strokeWidth="3" strokeDasharray="0 12" opacity=".18" />
        <circle className="spin-r" cx="260" cy="260" r="214" strokeWidth="3.2" strokeDasharray="0 11" opacity=".28" />
        <circle className="spin" cx="260" cy="260" r="184" strokeWidth="3.4" strokeDasharray="0 10" opacity=".42" style={{ animationDuration: "50s" }} />
        <circle className="spin-r" cx="260" cy="260" r="154" strokeWidth="3.6" strokeDasharray="0 9" opacity=".56" style={{ animationDuration: "40s" }} />
        <circle className="spin" cx="260" cy="260" r="124" strokeWidth="3.8" strokeDasharray="0 8" opacity=".75" style={{ animationDuration: "30s" }} />
        <circle className="spin-f" cx="260" cy="260" r="200" strokeWidth="2" strokeDasharray="90 1167" opacity=".9" />
        <path className="flow" d="M260 290 L112 150" strokeWidth="1.4" strokeDasharray="2 6" opacity=".7" />
        <path className="flow" d="M260 290 L424 172" strokeWidth="1.4" strokeDasharray="2 6" opacity=".7" style={{ animationDelay: "-.8s" }} />
        <path className="flow" d="M260 290 L350 456" strokeWidth="1.4" strokeDasharray="2 6" opacity=".7" style={{ animationDelay: "-1.6s" }} />
        <path className="flow" d="M260 290 L96 352" strokeWidth="1.4" strokeDasharray="2 6" opacity=".5" style={{ animationDelay: "-1.2s" }} />
      </g>
      <path
        className="march"
        d="M260 176 L334 204 V266 C334 312 302 342 260 360 C218 342 186 312 186 266 V204 Z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="0 8"
      />
      <circle className="ping" cx="260" cy="276" r="7" fill="#3fd0e6" />
      <circle cx="260" cy="276" r="7" fill="#3fd0e6" />
      <circle className="pop" cx="112" cy="150" r="6" fill="#ffffff" />
      <circle className="pop" cx="424" cy="172" r="6" fill="#ffffff" style={{ animationDelay: "1.5s" }} />
      <circle className="pop" cx="96" cy="352" r="6" fill="#ffffff" style={{ animationDelay: "3s" }} />
      <circle className="blink" cx="350" cy="456" r="7" fill="#ff5a4f" />
      <circle className="ping" cx="350" cy="456" r="7" fill="#ff5a4f" style={{ animationDelay: ".6s" }} />
    </svg>
  );
}

export function SmallOrb({ opacity = 1, core = true }: { opacity?: number; core?: boolean }) {
  return (
    <svg viewBox="0 0 300 300" aria-hidden="true" focusable="false" style={{ width: "100%", height: "auto", display: "block", opacity }}>
      <g fill="none" stroke="#3fd0e6" strokeLinecap="round">
        <circle className="spin" cx="150" cy="150" r="140" strokeWidth="3" strokeDasharray="0 10" opacity=".2" />
        <circle className="spin-r" cx="150" cy="150" r="110" strokeWidth="3.2" strokeDasharray="0 9" opacity=".38" />
        <circle className="spin" cx="150" cy="150" r="80" strokeWidth="3.4" strokeDasharray="0 8" opacity=".6" style={{ animationDuration: "40s" }} />
        <circle className="spin-f" cx="150" cy="150" r="110" strokeWidth="2" strokeDasharray="60 631" />
      </g>
      {core && (
        <>
          <circle className="ping" cx="150" cy="150" r="6" fill="#ffffff" />
          <circle cx="150" cy="150" r="6" fill="#ffffff" />
        </>
      )}
    </svg>
  );
}
