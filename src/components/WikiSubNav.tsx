import { Link, useRouterState } from "@tanstack/react-router";
import { WikiIcon, PromptsIcon } from "@/components/ui/bespoke-icons";

export function WikiSubNav({ current }: { current?: "wiki" | "prompts" }) {
  const routerState = useRouterState();
  const path = routerState.location.pathname;

  const activeTab = current || (path.startsWith("/prompts") ? "prompts" : "wiki");

  const base =
    "font-mono text-[11px] uppercase tracking-[0.15em] px-3.5 py-1.5 rounded-xl border transition inline-flex items-center gap-2 cursor-pointer font-semibold";
  const active = "bg-black text-white border-black shadow-2xs";
  const idle =
    "border-border text-muted-foreground hover:text-foreground hover:border-black/30 bg-card shadow-2xs hover:bg-secondary";

  return (
    <div className="flex items-center gap-2 flex-wrap mb-6">
      <Link to="/wiki" className={`${base} ${activeTab === "wiki" ? active : idle}`}>
        <WikiIcon size={14} /> Knowledge Base & SOPs
      </Link>
      <Link to="/prompts" className={`${base} ${activeTab === "prompts" ? active : idle}`}>
        <PromptsIcon size={14} /> Prompts Library
      </Link>
    </div>
  );
}
