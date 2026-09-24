import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { FolderKanban } from "lucide-react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../lib/auth-context";
import { RateCardManagerDialog } from "@/components/RateCardManagerDialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  StudioBrandIcon,
  MindMapIcon,
  PromptsIcon,
  PipelineIcon,
  RecurringIcon,
  ImplementationIcon,
  WikiIcon,
  ClientsIcon,
  LoginsIcon,
  WorkspaceIcon,
  RateCardIcon,
  ChangelogIcon,
  ChevronDownIcon,
} from "@/components/ui/bespoke-icons";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const isChunkError =
    error?.message?.includes("dynamically imported module") ||
    error?.message?.includes("Failed to fetch") ||
    error?.name === "ChunkLoadError";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isChunkError
            ? "A newer version of the application or module is available. Please reload the page to continue."
            : "Something went wrong on our end. You can try refreshing or head back home."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              if (isChunkError) {
                window.location.reload();
              } else {
                router.invalidate();
                reset();
              }
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {isChunkError ? "Reload page" : "Try again"}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

function TopNavigationBar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const navigate = useNavigate();
  const [rateCardOpen, setRateCardOpen] = useState(false);

  const isProjectsActive =
    currentPath.startsWith("/projects");

  const isPipelineActive =
    currentPath === "/" || currentPath.startsWith("/pipeline") || currentPath.startsWith("/recurring");

  const isMapsActive =
    currentPath.startsWith("/maps");

  const isPromptsActive =
    currentPath.startsWith("/prompts");

  const isImplActive =
    currentPath.startsWith("/implementation") || isProjectsActive;

  const isClientsActive =
    currentPath.startsWith("/clients") || currentPath.startsWith("/logins");

  const isGroupActive =
    currentPath.startsWith("/team") || currentPath.startsWith("/changelog");

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-gradient-to-r from-sky-100/90 via-slate-100/90 to-indigo-100/80 backdrop-blur-md shadow-2xs">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand logo */}
        <Link to="/implementation" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
            <StudioBrandIcon size={18} />
          </div>
          <div className="flex items-center">
            <span className="font-display font-bold text-sm tracking-tight text-foreground flex items-center gap-1.5">
              Mind Spark Studio <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-md bg-black text-white font-bold shadow-2xs">Pro</span>
            </span>
          </div>
        </Link>

        {/* Navigation links */}
        <nav className="hidden md:flex items-center gap-1">
          {/* Pipeline Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all outline-none cursor-pointer ${
                isPipelineActive
                  ? "bg-black text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <PipelineIcon size={14} />
              <span>Pipeline</span>
              <ChevronDownIcon size={12} className="opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-1 rounded-xl shadow-lg border border-border">
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/pipeline" })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer ${
                  currentPath.startsWith("/pipeline") ? "bg-black text-white font-semibold" : ""
                }`}
              >
                <PipelineIcon size={14} />
                <span>Pipeline Board</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/recurring" })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer ${
                  currentPath.startsWith("/recurring") ? "bg-black text-white font-semibold" : ""
                }`}
              >
                <RecurringIcon size={14} />
                <span>Recurring Projects</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Implementation Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all outline-none cursor-pointer ${
                isImplActive || isMapsActive
                  ? "bg-black text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <ImplementationIcon size={14} />
              <span>Implementation</span>
              <ChevronDownIcon size={12} className="opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-1 rounded-xl shadow-lg border border-border">
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/implementation" })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer ${
                  currentPath.startsWith("/implementation") ? "bg-black text-white font-semibold" : ""
                }`}
              >
                <ImplementationIcon size={14} />
                <span>Implementation Board</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/projects" })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer ${
                  currentPath.startsWith("/projects") ? "bg-black text-white font-semibold" : ""
                }`}
              >
                <FolderKanban size={14} />
                <span>Projects Directory</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/maps" })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer ${
                  isMapsActive ? "bg-black text-white font-semibold" : ""
                }`}
              >
                <MindMapIcon size={14} />
                <span>Mind Maps</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Wiki Dropdown (includes Wiki Knowledge Base & Prompts) */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all outline-none cursor-pointer ${
                currentPath.startsWith("/wiki") || isPromptsActive
                  ? "bg-black text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <WikiIcon size={14} />
              <span>Wiki</span>
              <ChevronDownIcon size={12} className="opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-1 rounded-xl shadow-lg border border-border">
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/wiki" })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer ${
                  currentPath.startsWith("/wiki") ? "bg-black text-white font-semibold" : ""
                }`}
              >
                <WikiIcon size={14} />
                <span>Knowledge Base & SOPs</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/prompts" })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer ${
                  isPromptsActive ? "bg-black text-white font-semibold" : ""
                }`}
              >
                <PromptsIcon size={14} />
                <span>Prompts Library</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Dedicated Clients dropdown sub-menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all outline-none cursor-pointer ${
                isClientsActive
                  ? "bg-black text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <ClientsIcon size={14} />
              <span>Clients</span>
              <ChevronDownIcon size={12} className="opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl shadow-lg border border-border">
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/clients" })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer ${
                  currentPath.startsWith("/clients") ? "bg-black text-white font-semibold" : ""
                }`}
              >
                <ClientsIcon size={14} />
                <span>Clients Directory</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/logins" })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer ${
                  currentPath.startsWith("/logins") ? "bg-black text-white font-semibold" : ""
                }`}
              >
                <LoginsIcon size={14} />
                <span>Client Logins</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Grouped dropdown for Team, Rate Card, Changelog */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all outline-none cursor-pointer ${
                isGroupActive
                  ? "bg-black text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <WorkspaceIcon size={14} />
              <span>Workspace</span>
              <ChevronDownIcon size={12} className="opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl shadow-lg border border-border">
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/team" })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer ${
                  currentPath.startsWith("/team") ? "bg-black text-white font-semibold" : ""
                }`}
              >
                <WorkspaceIcon size={14} />
                <span>Team Directory</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setRateCardOpen(true)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer"
              >
                <RateCardIcon size={14} />
                <span>Service Rate Card</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/changelog" })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer ${
                  currentPath.startsWith("/changelog") ? "bg-black text-white font-semibold" : ""
                }`}
              >
                <ChangelogIcon size={14} />
                <span>System Changelog</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Mobile quick indicator */}
        <div className="flex md:hidden items-center gap-1 text-xs">
          <Link
            to="/pipeline"
            className="px-2 py-1 rounded-lg bg-black text-white font-medium text-xs flex items-center gap-1.5 shadow-2xs"
          >
            <PipelineIcon size={12} />
            <span>Pipeline</span>
          </Link>
          <Link
            to="/implementation"
            className="px-2 py-1 rounded-lg bg-secondary text-foreground font-medium text-xs flex items-center gap-1.5"
          >
            <ImplementationIcon size={12} />
            <span>Board</span>
          </Link>
        </div>
      </div>

      {/* Secondary Mobile Nav Row */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto px-4 py-1.5 border-t border-border/40 text-xs no-scrollbar bg-muted/30">
        <Link to="/pipeline" className="shrink-0 text-muted-foreground hover:text-foreground px-1.5 py-0.5 flex items-center gap-1"><PipelineIcon size={12} /> Pipeline</Link>
        <Link to="/implementation" className="shrink-0 text-muted-foreground hover:text-foreground px-1.5 py-0.5 flex items-center gap-1"><ImplementationIcon size={12} /> Board</Link>
        <Link to="/" className="shrink-0 text-muted-foreground hover:text-foreground px-1.5 py-0.5 flex items-center gap-1"><MindMapIcon size={12} /> Mind Maps</Link>
        <Link to="/prompts" className="shrink-0 text-muted-foreground hover:text-foreground px-1.5 py-0.5 flex items-center gap-1"><PromptsIcon size={12} /> Prompts</Link>
        <Link to="/wiki" className="shrink-0 text-muted-foreground hover:text-foreground px-1.5 py-0.5 flex items-center gap-1"><WikiIcon size={12} /> Wiki</Link>
        <Link to="/clients" className="shrink-0 text-muted-foreground hover:text-foreground px-1.5 py-0.5 flex items-center gap-1"><ClientsIcon size={12} /> Clients</Link>
        <Link to="/recurring" className="shrink-0 text-muted-foreground hover:text-foreground px-1.5 py-0.5 flex items-center gap-1"><RecurringIcon size={12} /> Recurring</Link>
        <Link to="/team" className="shrink-0 text-muted-foreground hover:text-foreground px-1.5 py-0.5 flex items-center gap-1"><WorkspaceIcon size={12} /> Team</Link>
        <Link to="/logins" className="shrink-0 text-muted-foreground hover:text-foreground px-1.5 py-0.5 flex items-center gap-1"><LoginsIcon size={12} /> Logins</Link>
        <Link to="/changelog" className="shrink-0 text-muted-foreground hover:text-foreground px-1.5 py-0.5 flex items-center gap-1"><ChangelogIcon size={12} /> Changelog</Link>
      </div>

      <RateCardManagerDialog open={rateCardOpen} onOpenChange={setRateCardOpen} />
    </header>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Mind Spark Studio Pro" },
      {
        name: "description",
        content:
          "Integrated studio canvas for mind mapping, AI prompt engineering, project pipeline management, and team wiki.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,600;1,700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const handleSync = () => {
      queryClient.invalidateQueries();
    };
    window.addEventListener("supabase_storage_sync", handleSync);
    return () => window.removeEventListener("supabase_storage_sync", handleSync);
  }, [queryClient]);

  useEffect(() => {
    const handleResizeObserverError = (e: ErrorEvent) => {
      if (
        e.message?.includes("ResizeObserver loop completed with undelivered notifications") ||
        e.message?.includes("ResizeObserver loop limit exceeded")
      ) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };

    const handlePreloadError = (e: Event) => {
      e.preventDefault();
      const key = "mind_spark_preload_retry";
      const last = sessionStorage.getItem(key);
      const now = Date.now();
      if (!last || now - Number(last) > 8000) {
        sessionStorage.setItem(key, String(now));
        window.location.reload();
      }
    };

    window.addEventListener("error", handleResizeObserverError);
    window.addEventListener("vite:preloadError", handlePreloadError);
    return () => {
      window.removeEventListener("error", handleResizeObserverError);
      window.removeEventListener("vite:preloadError", handlePreloadError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-background text-foreground">
          <TopNavigationBar />
          <main className="flex-1 bg-gradient-to-b from-sky-100/90 via-slate-100/50 to-background min-h-[calc(100vh-3.5rem)]">
            <Outlet />
          </main>
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}
