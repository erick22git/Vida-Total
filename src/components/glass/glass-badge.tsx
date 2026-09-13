import { cn } from "@/lib/utils";

export interface GlassBadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function GlassBadge({ children, color = "#9a9aa5", className }: GlassBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] md:text-xs font-medium backdrop-blur-md",
        className,
      )}
      style={{
        color,
        background: `${color}1A`,
        boxShadow: `var(--glass-specular), inset 0 0 0 1px ${color}40`,
      }}
    >
      {children}
    </span>
  );
}
