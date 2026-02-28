import type { SVGProps } from 'react';

/**
 * Two nodes connected at a central point (compare/merge). Use for Vehicle Comparison.
 */
export function VehicleComparisonIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Left circle (slightly higher) */}
      <circle cx="7" cy="9" r="3.5" />
      {/* Right circle (slightly lower) */}
      <circle cx="17" cy="15" r="3.5" />
      {/* L from left circle: right then down to center (12,12) */}
      <path d="M10.5 9 L12 9 L12 12" />
      {/* L from right circle: left then up to center (12,12) */}
      <path d="M13.5 15 L12 15 L12 12" />
    </svg>
  );
}
