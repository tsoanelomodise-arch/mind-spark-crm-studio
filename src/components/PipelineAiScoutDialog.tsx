import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  researchWebsiteRefresherLeads,
  type ResearchedBusiness,
  type BusinessResearchResponse,
} from "@/lib/pipeline-ai.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Search,
  MapPin,
  Building2,
  Globe,
  Phone,
  Mail,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Plus,
  Loader2,
  Coins,
  RefreshCw,
  ExternalLink,
  Zap,
  Trash2,
  BookmarkCheck,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { PipelinePitchDialog } from "@/components/PipelinePitchDialog";

interface PipelineAiScoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STORAGE_RESULTS_KEY = "mindspark_scout_results";
const STORAGE_IMPORTED_KEY = "mindspark_scout_imported_ids";

const POPULAR_LOCATIONS = [
  "Sandton, Johannesburg",
  "Cape Town City Bowl",
  "Rosebank & Parkhurst",
  "Durban North & Umhlanga",
  "Pretoria East",
  "Austin, Texas",
  "London, UK",
];

const POPULAR_INDUSTRIES = [
  "Boutique Hotels & Lodges",
  "Medical & Dental Practices",
  "Law Firms & Legal Services",
  "Local Restaurants & Cafes",
  "Plumbing & HVAC Contractors",
  "Fitness Studios & Gyms",
  "Real Estate Agencies",
];

export function PipelineAiScoutDialog({ open, onOpenChange }: PipelineAiScoutDialogProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const scoutFn = useServerFn(researchWebsiteRefresherLeads);

  const [location, setLocation] = useState("Cape Town City Bowl");
  const [industry, setIndustry] = useState("Boutique Hotels & Lodges");
  const [refresherFocus, setRefresherFocus] = useState(
    "Outdated UI, poor mobile layout, missing online booking, slow page speeds",
  );
  const [manualWebsiteUrl, setManualWebsiteUrl] = useState("");
  const [manualBusinessName, setManualBusinessName] = useState("");
  const [count, setCount] = useState(4);

  const [isSearching, setIsSearching] = useState(false);

  // Initialize from saved localStorage if present
  const [results, setResults] = useState<BusinessResearchResponse | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_RESULTS_KEY);
      return saved ? (JSON.parse(saved) as BusinessResearchResponse) : null;
    } catch {
      return null;
    }
  });

  const [importedIds, setImportedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_IMPORTED_KEY);
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const [importingId, setImportingId] = useState<string | null>(null);
  const [pitchBusiness, setPitchBusiness] = useState<ResearchedBusiness | null>(null);
  const [pitchDialogOpen, setPitchDialogOpen] = useState(false);

  // Save results to localStorage whenever updated
  useEffect(() => {
    if (results) {
      localStorage.setItem(STORAGE_RESULTS_KEY, JSON.stringify(results));
    } else {
      localStorage.removeItem(STORAGE_RESULTS_KEY);
    }
  }, [results]);

  // Save imported IDs to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_IMPORTED_KEY, JSON.stringify(Array.from(importedIds)));
  }, [importedIds]);

  const handleResearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualWebsiteUrl.trim() && !location.trim()) {
      toast.error("Please specify a target location or enter a website URL to audit");
      return;
    }

    setIsSearching(true);

    try {
      const data = await scoutFn({
        data: {
          location: location.trim() || "Global",
          industry: industry.trim() || "General Business",
          refresherFocus: refresherFocus.trim(),
          manualWebsiteUrl: manualWebsiteUrl.trim(),
          manualBusinessName: manualBusinessName.trim(),
          count: manualWebsiteUrl.trim() ? 1 : count,
        },
      });

      // Accumulate new leads with existing saved results if present
      if (results && results.businesses && results.businesses.length > 0) {
        setResults({
          ...data,
          businesses: [...data.businesses, ...results.businesses],
        });
      } else {
        setResults(data);
      }

      toast.success(
        manualWebsiteUrl.trim()
          ? `Audited website and generated refresher lead report!`
          : `Found and saved ${data.businesses.length} website refresher lead opportunities!`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Research failed: ${msg}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeleteLead = (leadId: string, businessName: string) => {
    if (!results) return;
    const updatedBusinesses = results.businesses.filter((b) => b.id !== leadId);
    if (updatedBusinesses.length === 0) {
      setResults(null);
    } else {
      setResults({
        ...results,
        businesses: updatedBusinesses,
      });
    }
    toast.info(`Removed ${businessName} from scout results`);
  };

  const handleClearAllResults = () => {
    setResults(null);
    localStorage.removeItem(STORAGE_RESULTS_KEY);
    toast.info("Cleared saved scout research results");
  };

  const handleImportLead = async (business: ResearchedBusiness) => {
    setImportingId(business.id);
    try {
      // 1. Check or create Client
      let clientId: string | null = null;
      const { data: existingClients } = await supabase
        .from("clients")
        .select("id")
        .ilike("name", business.businessName)
        .limit(1);

      if (existingClients && existingClients.length > 0) {
        clientId = existingClients[0].id;
      } else {
        const { data: newClient, error: clientErr } = await supabase
          .from("clients")
          .insert({
            name: business.businessName,
            notes: `Website: ${business.websiteUrl} | Phone: ${business.phone} | Email: ${business.email}`,
          })
          .select("id")
          .single();

        if (clientErr) throw new Error(`Could not create client: ${clientErr.message}`);
        clientId = newClient.id;
      }

      // 2. Build detailed lead notes
      const notesMarkdown = `### 🌐 Website Refresher Audit Report
**Business Name:** ${business.businessName}
**Industry:** ${business.industry}
**Location:** ${business.location}
**Website:** ${business.websiteUrl}
**Contact:** ${business.phone} | ${business.email}
**Refresher Urgency:** ${business.refresherUrgency} | **Opportunity Score:** ${business.opportunityScore}/100
**Est. Value:** ZAR ${business.estimatedValue.toLocaleString()}

#### ⚠️ Website Deficiencies
${business.currentIssues.map((issue) => `- ${issue}`).join("\n")}

#### 🎯 Proposed Redesign Scope
${business.proposedServices.map((s) => `- ${s}`).join("\n")}

#### 💡 Outreach & Pitch Strategy
${business.pitchStrategy}`;

      // 3. Create Project in 'lead' pipeline stage
      const { error: projErr } = await supabase.from("projects").insert({
        name: `${business.businessName} Website Redesign`,
        client_id: clientId,
        status: "lead",
        opportunity_value: business.estimatedValue,
        project_type: "website",
        notes: notesMarkdown,
        created_by: user?.id ?? null,
      });

      if (projErr) throw new Error(`Could not create pipeline project: ${projErr.message}`);

      // 4. Update UI & invalidate queries
      setImportedIds((prev) => new Set(prev).add(business.id));
      toast.success(`Imported ${business.businessName} into your Pipeline as a Lead!`);

      qc.invalidateQueries({ queryKey: ["projects", "pipeline"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl border-border shadow-2xl">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                Pipeline AI — Website Refresher Lead Scout
              </DialogTitle>
              <DialogDescription className="text-xs text-indigo-200/80">
                AI market research for local businesses in need of website redesigns, mobile
                optimization, & digital upgrades.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background">
          {/* Form Controls */}
          <form
            onSubmit={handleResearch}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border border-border/80"
          >
            {/* Location Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <MapPin className="h-3.5 w-3.5 text-indigo-500" /> Target Area / Location
              </Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Cape Town City Bowl or Sandton"
                className="bg-background text-sm"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {POPULAR_LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocation(loc)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                      location === loc
                        ? "bg-indigo-600 text-white border-indigo-600 font-medium"
                        : "bg-background hover:bg-accent border-border text-muted-foreground"
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Industry Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Building2 className="h-3.5 w-3.5 text-indigo-500" /> Industry / Business Category
              </Label>
              <Input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Boutique Hotels or Dental Clinics"
                className="bg-background text-sm"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {POPULAR_INDUSTRIES.slice(0, 5).map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => setIndustry(ind)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                      industry === ind
                        ? "bg-indigo-600 text-white border-indigo-600 font-medium"
                        : "bg-background hover:bg-accent border-border text-muted-foreground"
                    }`}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual Website URL Input (Optional Direct Scout) */}
            <div className="md:col-span-2 space-y-2 p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/80">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold flex items-center gap-1.5 text-indigo-950 dark:text-indigo-200">
                  <Globe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Audit Specific Website URL (Direct Lead Scout)
                </Label>
                {manualWebsiteUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setManualWebsiteUrl("");
                      setManualBusinessName("");
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
                  >
                    Clear Direct Website URL
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <Input
                  value={manualWebsiteUrl}
                  onChange={(e) => setManualWebsiteUrl(e.target.value)}
                  placeholder="e.g. www.capehotel.co.za or https://myclient.com"
                  className="bg-background text-sm border-indigo-200 dark:border-indigo-800"
                />
                <Input
                  value={manualBusinessName}
                  onChange={(e) => setManualBusinessName(e.target.value)}
                  placeholder="Business Name (Optional, e.g. Cape Lodge)"
                  className="bg-background text-sm border-indigo-200 dark:border-indigo-800"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Enter any specific company website URL to generate an instant AI redesign audit, opportunity score, & sales pitch report.
              </p>
            </div>

            {/* Refresher Criteria Focus */}
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Zap className="h-3.5 w-3.5 text-indigo-500" /> Website Refresher Deficiencies to
                Audit
              </Label>
              <Input
                value={refresherFocus}
                onChange={(e) => setRefresherFocus(e.target.value)}
                placeholder="e.g. Outdated design, missing mobile layout, non-responsive, slow load time"
                className="bg-background text-sm"
              />
            </div>

            {/* Action Bar inside form */}
            <div className="md:col-span-2 flex items-center justify-between pt-2 border-t border-border/60">
              <div className="flex items-center gap-2">
                {!manualWebsiteUrl.trim() && (
                  <>
                    <Label className="text-xs text-muted-foreground">Candidate Lead Count:</Label>
                    {[3, 4, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCount(num)}
                        className={`text-xs px-2.5 py-1 rounded-md border font-medium cursor-pointer transition-colors ${
                          count === num
                            ? "bg-black text-white dark:bg-white dark:text-black border-black"
                            : "bg-background hover:bg-accent border-border text-muted-foreground"
                        }`}
                      >
                        {num} Leads
                      </button>
                    ))}
                  </>
                )}
                {manualWebsiteUrl.trim() && (
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" /> Direct Single-Site Refresher Audit
                  </span>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSearching}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md cursor-pointer"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {manualWebsiteUrl.trim() ? "Auditing Website..." : "Scanning Market..."}
                  </>
                ) : manualWebsiteUrl.trim() ? (
                  <>
                    <Zap className="h-4 w-4" />
                    Audit Target Website
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Research Refresher Leads
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Loading Animation State */}
          {isSearching && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
              <div className="p-4 rounded-full bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 animate-bounce">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-semibold text-foreground">
                  AI Market Scout in Progress
                </h4>
                <p className="text-xs text-muted-foreground max-w-md">
                  Analyzing websites, mobile compatibility, design eras, and contact metrics for{" "}
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {industry}
                  </span>{" "}
                  in{" "}
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {location}
                  </span>
                  ...
                </p>
              </div>
            </div>
          )}

          {/* Results Output */}
          {results && !isSearching && (
            <div className="space-y-5">
              {/* Market Summary Header Card */}
              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                        Market Intelligence Scan
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 font-semibold">
                        {results.businesses.length} {results.businesses.length === 1 ? "Candidate" : "Candidates"}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-medium border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                        <BookmarkCheck className="h-3 w-3" /> Saved
                      </span>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {results.summaryOverview}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllResults}
                  className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 gap-1.5 shrink-0 cursor-pointer"
                  title="Discard all saved research results"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear Scout Results
                </Button>
              </div>

              {/* Business Lead Cards Grid */}
              <div className="grid grid-cols-1 gap-4">
                {results.businesses.map((b) => {
                  const isImported = importedIds.has(b.id);
                  const isImporting = importingId === b.id;

                  const urgencyColor =
                    b.refresherUrgency === "Critical"
                      ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800"
                      : b.refresherUrgency === "High"
                        ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                        : "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";

                  return (
                    <div
                      key={b.id}
                      className={`p-5 rounded-xl border transition-all shadow-sm ${
                        isImported
                          ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                          : "bg-card hover:border-indigo-300 dark:hover:border-indigo-800 border-border"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        {/* Business Info */}
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <h3 className="text-base font-bold text-foreground">
                              {b.businessName}
                            </h3>
                            <span
                              className={`text-[10px] px-2.5 py-0.5 rounded-full border font-semibold ${urgencyColor}`}
                            >
                              {b.refresherUrgency} Refresher Urgency
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium border border-border">
                              Score: {b.opportunityScore}/100
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                              {b.industry}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {b.location}
                            </span>
                            {(() => {
                              const formattedUrl =
                                b.websiteUrl.startsWith("http://") ||
                                b.websiteUrl.startsWith("https://")
                                  ? b.websiteUrl
                                  : `https://${b.websiteUrl}`;
                              return (
                                <a
                                  href={formattedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium underline underline-offset-2 transition-colors"
                                  title={`Visit ${b.businessName} website`}
                                >
                                  <Globe className="h-3.5 w-3.5" /> {b.websiteUrl}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              );
                            })()}
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent(
                                `${b.businessName} ${b.location}`,
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-[11px]"
                              title={`Search Google for ${b.businessName}`}
                            >
                              <Search className="h-3 w-3" /> Search Lead
                            </a>
                          </div>

                          {/* Contact snippet */}
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1">
                            <a
                              href={`tel:${b.phone.replace(/[^0-9+]/g, "")}`}
                              className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                              title={`Call ${b.phone}`}
                            >
                              <Phone className="h-3 w-3" /> {b.phone}
                            </a>
                            <a
                              href={`mailto:${b.email}`}
                              className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                              title={`Email ${b.email}`}
                            >
                              <Mail className="h-3 w-3" /> {b.email}
                            </a>
                          </div>

                          {/* Current Deficiencies */}
                          <div className="pt-2">
                            <p className="text-[11px] font-semibold text-foreground/80 mb-1 flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Website
                              Deficiencies Identified:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {b.currentIssues.map((issue, idx) => (
                                <span
                                  key={idx}
                                  className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200/80 dark:border-amber-900"
                                >
                                  • {issue}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Pitch Strategy */}
                          <div className="pt-2 p-3 rounded-lg bg-muted/60 text-xs space-y-1 border border-border/60">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Recommended
                              Outreach Strategy:
                            </span>
                            <p className="text-muted-foreground leading-relaxed">
                              {b.pitchStrategy}
                            </p>
                          </div>
                        </div>

                        {/* Value & Action Panel */}
                        <div className="shrink-0 flex md:flex-col items-end justify-between md:justify-start gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                              Est. Project Value
                            </span>
                            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-0.5">
                              <Coins className="h-4 w-4" /> ZAR {b.estimatedValue.toLocaleString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* 1-Page Pitch Proposal Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPitchBusiness(b);
                                setPitchDialogOpen(true);
                              }}
                              className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 gap-1.5 h-9 shadow-sm cursor-pointer shrink-0 font-medium"
                              title="Automatically generate a 1-page pitch proposal for this lead"
                            >
                              <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              1-Page Pitch
                            </Button>

                            {/* Delete / Dismiss lead button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteLead(b.id, b.businessName)}
                              className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-border cursor-pointer shrink-0"
                              title="Delete/Dismiss lead from scout results"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>

                            {isImported ? (
                              <Button
                                disabled
                                size="sm"
                                className="bg-emerald-600 text-white gap-1.5 h-9 cursor-default"
                              >
                                <CheckCircle2 className="h-4 w-4" /> Added to Pipeline
                              </Button>
                            ) : (
                              <Button
                                onClick={() => handleImportLead(b)}
                                disabled={isImporting}
                                size="sm"
                                className="bg-black hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-slate-200 gap-1.5 h-9 shadow-sm cursor-pointer"
                              >
                                {isImporting ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4" /> Add to Pipeline
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* 1-Page Pitch Proposal Dialog */}
      <PipelinePitchDialog
        open={pitchDialogOpen}
        onOpenChange={setPitchDialogOpen}
        business={pitchBusiness}
      />
    </Dialog>
  );
}
