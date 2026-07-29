import { Link, useRouterState } from "@tanstack/react-router";
import { ImplementationIcon, MindMapIcon } from "@/components/ui/bespoke-icons";

export function ImplementationSubNav({
  current,
}: {
  current?: "board" | "mind-maps";
}) {
  const routerState = useRouterState();
  const path = routerState.location.pathname;

  const activeTab =
    current ||
    (path === "/" || path.startsWith("/maps") ? "mind-maps" : "board");

  const base =
    "font-mono text-[11px] uppercase tracking-[0.15em] px-3.5 py-1.5 rounded-xl border transition inline-flex items-center gap-2 cursor-pointer font-semibold";
  const active =
    "bg-black text-white border-black shadow-2xs";
  const idle =
    "border-border text-muted-foreground hover:text-foreground hover:border-black/30 bg-card shadow-2xs hover:bg-secondary";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Link
        to="/implementation"
        className={`${base} ${activeTab === "board" ? active : idle}`}
      >
        <ImplementationIcon size={14} /> Board & Tasks
      </Link>
      <Link
        to="/"
        className={`${base} ${activeTab === "mind-maps" ? active : idle}`}
      >
        <MindMapIcon size={14} /> Mind Maps
      </Link>
    </div>
  );
}

