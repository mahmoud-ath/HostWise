import { ArrowLeft } from "lucide-react";

/**
 * Creative 404 built as an architectural floor plan: the room you are looking
 * for is not in the drawings. A dashed "404" outline sits in an empty planned
 * space, with dimension lines, furniture hints, and a drawing title block.
 */
function BlueprintPlan() {
  const gridLines = [];
  for (let i = 32; i < 640; i += 32) {
    gridLines.push(
      <line key={`v${i}`} x1={i} y1={0} x2={i} y2={480} stroke="#EFEFEF" />
    );
    gridLines.push(
      <line key={`h${i}`} x1={0} y1={i} x2={640} y2={i} stroke="#EFEFEF" />
    );
  }

  return (
    <svg
      viewBox="0 0 640 480"
      className="mx-auto w-full max-w-2xl"
      aria-hidden="true"
    >
      {/* grid + paper border */}
      <g>{gridLines}</g>
      <rect x={8} y={8} width={624} height={464} fill="none" stroke="#E5E5E5" />

      {/* dimension lines */}
      <g stroke="#191919" opacity="0.45" strokeWidth="1">
        <line x1={120} y1={430} x2={500} y2={430} />
        <line x1={120} y1={426} x2={120} y2={434} />
        <line x1={500} y1={426} x2={500} y2={434} />
        <line x1={560} y1={140} x2={560} y2={360} />
        <line x1={556} y1={140} x2={564} y2={140} />
        <line x1={556} y1={360} x2={564} y2={360} />
        <line x1={140} y1={118} x2={300} y2={118} />
        <line x1={140} y1={114} x2={140} y2={122} />
        <line x1={300} y1={114} x2={300} y2={122} />
      </g>
      <g
        className="font-mono"
        fill="#191919"
        opacity="0.45"
        fontSize="11"
        textAnchor="middle"
      >
        <text x={310} y={424}>6.4m</text>
        <text x={548} y={254} transform="rotate(-90 548 254)">3.6m</text>
        <text x={220} y={108}>2.4m</text>
      </g>

      {/* house plan */}
      <g stroke="#191919" strokeWidth="2">
        <rect x={140} y={140} width={360} height={220} fill="#F7F7F5" />
        <line x1={300} y1={140} x2={300} y2={240} strokeWidth="1.5" />
        <line x1={140} y1={240} x2={260} y2={240} strokeWidth="1.5" />
        {/* door swings */}
        <path d="M 260 240 q 0 26 26 26" fill="none" strokeWidth="1.25" />
        <path d="M 300 220 q 26 0 26 26" fill="none" strokeWidth="1.25" />
        {/* windows */}
        <g stroke="#191919" strokeWidth="1">
          <line x1={180} y1={140} x2={240} y2={140} />
          <line x1={180} y1={144} x2={240} y2={144} />
          <line x1={500} y1={240} x2={500} y2={300} />
          <line x1={496} y1={240} x2={496} y2={300} />
        </g>
      </g>

      {/* furniture hints */}
      <g stroke="#191919" strokeWidth="1" fill="none" opacity="0.6">
        <rect x={160} y={160} width={72} height={34} />
        <line x1={196} y1={160} x2={196} y2={194} />
        <rect x={416} y={160} width={60} height={96} />
        <line x1={416} y1={196} x2={476} y2={196} />
        <circle cx={210} cy={300} r={14} />
      </g>

      {/* missing room — the 404 */}
      <rect
        x={140}
        y={60}
        width={160}
        height={70}
        fill="#7B39FC0D"
        stroke="#7B39FC"
        strokeWidth="1.5"
        strokeDasharray="6 4"
      />
      <text
        x={220}
        y={104}
        textAnchor="middle"
        className="font-mono"
        fill="#7B39FC"
        fontSize="28"
        fontWeight="600"
      >
        404
      </text>
      <text
        x={220}
        y={48}
        textAnchor="middle"
        className="font-mono"
        fill="#191919"
        opacity="0.5"
        fontSize="9"
        letterSpacing="2"
      >
        MASTER PLAN · ROOM NOT FOUND
      </text>

      {/* compass */}
      <g transform="translate(560 40)">
        <circle r={16} fill="none" stroke="#191919" strokeWidth="1" opacity="0.6" />
        <path d="M 0 -9 L 4 6 L 0 3 L -4 6 Z" fill="#191919" opacity="0.6" />
        <text
          x={0}
          y={-20}
          textAnchor="middle"
          className="font-mono"
          fill="#191919"
          opacity="0.6"
          fontSize="10"
        >
          N
        </text>
      </g>

      {/* drawing title block */}
      <g transform="translate(400 400)">
        <rect
          width={220}
          height={56}
          fill="#fff"
          stroke="#191919"
          strokeWidth="1"
          opacity="0.85"
        />
        <text
          x={10}
          y={20}
          className="font-mono"
          fill="#191919"
          fontSize="11"
          fontWeight="600"
        >
          HOSTWISE · ARCHITECTURE DEPT.
        </text>
        <text x={10} y={38} className="font-mono" fill="#191919" opacity="0.55" fontSize="10">
          DWG 404 — PAGE NOT FOUND
        </text>
      </g>
    </svg>
  );
}

export default function NotFound() {
  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-white px-6 py-16 text-center">
      <BlueprintPlan />

      <h1 className="mt-6 font-serif text-4xl font-normal tracking-tight text-[#191919] md:text-5xl">
        This page isn't in the plan.
      </h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#191919]/70 md:text-base">
        We couldn't find that room. The address doesn't exist on our floor
        plan — but the rest of the house is exactly where you left it.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <a
          href="#/"
          className="inline-flex items-center gap-2 rounded-full bg-[#191919] px-7 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#191919]/90"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
          Back to home
        </a>
        <a
          href="#/docs"
          className="rounded-full border border-[#191919]/15 px-7 py-3 text-sm font-medium text-[#191919] transition-colors duration-200 hover:bg-soft"
        >
          Browse the guide
        </a>
      </div>
    </main>
  );
}
