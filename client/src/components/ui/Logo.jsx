import { Link } from "react-router-dom";

export default function Logo({ to = "/", size = 28 }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 font-semibold tracking-tight">
      <span
        className="grid place-items-center rounded-lg bg-gradient-to-br from-purple to-teal text-[#0B0D12]"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="8 6 2 12 8 18" />
          <polyline points="16 6 22 12 16 18" />
        </svg>
      </span>
      <span className="text-[17px]">CodeMate</span>
    </Link>
  );
}
