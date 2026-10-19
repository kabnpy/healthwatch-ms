/**
 * Official Agency Rubber Stamp and Signature Block
 * Renders an official certified broker seal and authorized signatory mark
 * for formal print schedules, cover notes, and certified insurer cover slips.
 */

interface OfficialAgencyStampProps {
  signerName?: string
  date?: string
  className?: string
}

export function OfficialAgencyStamp({
  signerName = "Authorized Account Manager",
  date,
  className = "",
}: OfficialAgencyStampProps) {
  const displayDate =
    date ||
    new Date()
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .toUpperCase()

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
    >
      {/* Official Seal SVG */}
      <svg
        viewBox="0 0 240 140"
        className="w-56 h-32 text-slate-900 dark:text-slate-100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="HealthWatch Official Agency Stamp"
      >
        <title>HealthWatch Insurance Agency Official Stamp</title>
        {/* Outer Ellipse */}
        <ellipse
          cx="120"
          cy="70"
          rx="112"
          ry="62"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray="4 2"
        />
        {/* Inner Solid Border */}
        <ellipse
          cx="120"
          cy="70"
          rx="104"
          ry="54"
          stroke="currentColor"
          strokeWidth="1.2"
        />

        {/* Agency Title Arc */}
        <text
          x="120"
          y="38"
          textAnchor="middle"
          fontSize="9.5"
          fontFamily="monospace"
          fontWeight="bold"
          letterSpacing="1.2"
          fill="currentColor"
        >
          HEALTHWATCH INSURANCE
        </text>

        {/* Subtitle */}
        <text
          x="120"
          y="52"
          textAnchor="middle"
          fontSize="7.5"
          fontFamily="sans-serif"
          fontWeight="semibold"
          letterSpacing="1.5"
          fill="currentColor"
        >
          AGENCY OPERATIONS
        </text>

        {/* Center Stamped Banner */}
        <rect
          x="40"
          y="60"
          width="160"
          height="20"
          fill="currentColor"
          fillOpacity="0.06"
          stroke="currentColor"
          strokeWidth="0.8"
        />
        <text
          x="120"
          y="74"
          textAnchor="middle"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="black"
          letterSpacing="1.8"
          fill="currentColor"
        >
          * CERTIFIED OFFICIAL *
        </text>

        {/* Date Stamp */}
        <text
          x="120"
          y="94"
          textAnchor="middle"
          fontSize="8"
          fontFamily="monospace"
          fontWeight="bold"
          letterSpacing="1"
          fill="currentColor"
        >
          {displayDate}
        </text>

        {/* Location Footer Arc */}
        <text
          x="120"
          y="112"
          textAnchor="middle"
          fontSize="8"
          fontFamily="monospace"
          fontWeight="bold"
          letterSpacing="1.5"
          fill="currentColor"
        >
          NAIROBI, KENYA
        </text>

        {/* Stylized Digital Signature Overlay */}
        <path
          d="M 55 82 Q 75 45 95 72 T 135 68 Q 155 58 175 75 Q 185 85 200 68"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
      </svg>

      {/* Subtext under stamp */}
      <div className="absolute -bottom-2 text-center">
        <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
          {signerName}
        </span>
      </div>
    </div>
  )
}
