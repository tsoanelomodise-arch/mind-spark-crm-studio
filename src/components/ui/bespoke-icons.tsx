import React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  strokeWidth?: number;
}

/**
 * Bespoke Premium Icon System for Mind Spark Studio
 * Crafted with geometric precision, 1.75px uniform stroke weights, 
 * rounded caps/joins, and optical balance comparable to Linear, Apple & Stripe UI.
 */

// 1. Studio Brand Mark
export function StudioBrandIcon({ size = 20, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" fillOpacity="0.2" />
      <circle cx="7" cy="8" r="1.5" />
      <circle cx="17" cy="8" r="1.5" />
      <circle cx="7" cy="16" r="1.5" />
      <circle cx="17" cy="16" r="1.5" />
      <path d="M8.2 9L10.6 10.8" />
      <path d="M15.8 9L13.4 10.8" />
      <path d="M8.2 15L10.6 13.2" />
      <path d="M15.8 15L13.4 13.2" />
    </svg>
  );
}

// 2. Mind Maps Icon
export function MindMapIcon({ size = 18, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="6" r="2.75" />
      <circle cx="5" cy="18" r="2.25" />
      <circle cx="12" cy="18" r="2.25" />
      <circle cx="19" cy="18" r="2.25" />
      <path d="M12 8.75V15.75" />
      <path d="M10 8.25L5.75 15.8" />
      <path d="M14 8.25L18.25 15.8" />
    </svg>
  );
}

// 3. Prompts Icon
export function PromptsIcon({ size = 18, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M4 17l5-5-5-5" />
      <line x1="12" y1="17" x2="18" y2="17" />
      <path d="M19 4l.8 2.2L22 7l-2.2.8L19 10l-.8-2.2L16 7l2.2-.8z" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

// 4. Pipeline Board Icon
export function PipelineIcon({ size = 18, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="3" width="5.5" height="18" rx="1.5" />
      <rect x="11.25" y="3" width="5.5" height="18" rx="1.5" />
      <rect x="19.5" y="3" width="1.5" height="18" rx="0.75" opacity="0.4" />
      <path d="M4.5 7h2.5" />
      <path d="M4.5 10.5h1.5" />
      <path d="M12.75 7h2.5" />
      <path d="M12.75 10.5h2.5" />
      <path d="M12.75 14h1.5" />
    </svg>
  );
}

// 5. Recurring Cycle Icon
export function RecurringIcon({ size = 18, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M21 12A9 9 0 0 0 6 5.3L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7" />
      <path d="M21 21v-5h-5" />
    </svg>
  );
}

// 6. Implementation Icon
export function ImplementationIcon({ size = 18, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

// 7. Wiki Icon
export function WikiIcon({ size = 18, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M9 7h6" />
      <path d="M9 11h4" />
    </svg>
  );
}

// 8. Clients Directory Icon
export function ClientsIcon({ size = 18, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M12 11v3" />
      <path d="M9.5 12.5h5" />
    </svg>
  );
}

// 9. Client Logins Vault Icon
export function LoginsIcon({ size = 18, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="16" r="1.5" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// 10. Workspace / Team Icon
export function WorkspaceIcon({ size = 18, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// 11. Rate Card Icon
export function RateCardIcon({ size = 18, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
      <line x1="14" y1="15" x2="18" y2="15" />
    </svg>
  );
}

// 12. System Changelog Icon
export function ChangelogIcon({ size = 18, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

// 13. Search / Switcher Icon
export function SearchIcon({ size = 18, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// 14. Plus Add Icon
export function PlusIcon({ size = 18, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// 15. Chevron Down Icon
export function ChevronDownIcon({ size = 16, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// 16. Arrow Right Icon
export function ArrowRightIcon({ size = 16, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// 17. Checkmark Icon
export function CheckIcon({ size = 16, className = "", strokeWidth = 2, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// 18. Trash Delete Icon
export function TrashIcon({ size = 16, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// 19. Sparkle AI Icon
export function SparkleIcon({ size = 16, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
    </svg>
  );
}

// 20. Map Extraction Seedling Icon
export function SeedlingIcon({ size = 16, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M12 10a6 6 0 0 0-6-6H3v2a6 6 0 0 0 6 6h3" />
      <path d="M12 14a6 6 0 0 1 6-6h3v2a6 6 0 0 1-6 6h-3" />
      <path d="M12 20V10" />
    </svg>
  );
}

// 21. Link Icon
export function LinkIcon({ size = 16, className = "", strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

// 22. Dark Square Badge Container for Bespoke Icons
export function BespokeBadge({
  children,
  className = "",
  size = "md",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "w-7 h-7 rounded-lg text-xs",
    md: "w-9 h-9 rounded-xl text-sm",
    lg: "w-11 h-11 rounded-2xl text-base",
  }[size];

  return (
    <div
      className={`bg-black text-white shadow-2xs flex items-center justify-center shrink-0 ${sizeClasses} ${className}`}
    >
      {children}
    </div>
  );
}
