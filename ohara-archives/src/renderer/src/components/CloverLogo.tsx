interface CloverLogoProps {
  size?: number
  color?: string
}

export default function CloverLogo({ size = 32, color = '#c9a84c' }: CloverLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top-left lobe */}
      <circle cx="17" cy="16" r="11" fill={color} opacity="0.92" />
      {/* Top-right lobe */}
      <circle cx="31" cy="16" r="11" fill={color} opacity="0.92" />
      {/* Bottom center lobe */}
      <circle cx="24" cy="28" r="11" fill={color} opacity="0.92" />
      {/* Center overlap brightener */}
      <circle cx="24" cy="20" r="5" fill={color} opacity="0.3" />
      {/* Stem */}
      <rect x="21.5" y="36" width="5" height="10" rx="2.5" fill={color} opacity="0.85" />
    </svg>
  )
}
