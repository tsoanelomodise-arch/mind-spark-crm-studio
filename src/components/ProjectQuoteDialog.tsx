import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { generateProjectQuote, type ProjectQuoteResult, type QuoteBreakdownItem, type ServiceSummaryBreakdown } from "@/lib/quote.functions";
import {
  ServiceRateItem,
  getStoredRateCard,
  calculateBlendedRate,
} from "@/lib/rate-card";
import {
  getSavedQuoteRecord,
  saveQuoteRecord,
  clearQuoteRecord,
} from "@/lib/quote-storage";
import { RateCardManagerDialog } from "@/components/RateCardManagerDialog";
import { supabase } from "@/integrations/supabase/client";
import { formatZAR } from "@/lib/pipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calculator,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  ArrowRight,
  RefreshCw,
  Clock,
  DollarSign,
  Layers,
  FileText,
  CreditCard,
  Settings2,
  Edit3,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  Pencil,
  BadgeCheck,
  History,
  FolderSync,
  ChevronDown,
  Notebook,
  StickyNote,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface ProjectQuoteDialogProps {
  projectId: string;
  projectName: string;
  projectType?: string | null;
  currentNotes?: string | null;
  currentValue?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuoteApplied?: (newQuote: number, updatedNotes: string) => void;
}

export function ProjectQuoteDialog({
  projectId,
  projectName,
  projectType,
  currentNotes,
  currentValue,
  open,
  onOpenChange,
  onQuoteApplied,
}: ProjectQuoteDialogProps) {
  const quoteFn = useServerFn(generateProjectQuote);

  const [scopeText, setScopeText] = useState("");
  const [hourlyRate, setHourlyRate] = useState<number>(750);
  const [currency, setCurrency] = useState<string>("ZAR");
  const [useRateCard, setUseRateCard] = useState<boolean>(true);
  const [rateCardItems, setRateCardItems] = useState<ServiceRateItem[]>([]);
  const [rateCardManagerOpen, setRateCardManagerOpen] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProjectQuoteResult | null>(null);
  const [originalResult, setOriginalResult] = useState<ProjectQuoteResult | null>(null);
  const [isAmending, setIsAmending] = useState<boolean>(false);
  const [isCustomized, setIsCustomized] = useState<boolean>(false);
  const [applying, setApplying] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // New assumption & risk draft inputs
  const [newAssumption, setNewAssumption] = useState("");
  const [newRisk, setNewRisk] = useState("");

  useEffect(() => {
    if (open) {
      const stored = getStoredRateCard();
      setRateCardItems(stored);
      if (stored.length > 0) {
        setHourlyRate(calculateBlendedRate(stored));
      }

      // Check for saved quote record for this project
      const record = getSavedQuoteRecord(projectId);
      if (record) {
        setResult(record.result);
        setOriginalResult(record.originalResult || record.result);
        setScopeText(record.scopeText || "");
        setIsCustomized(record.isCustomized || false);
        setSavedAt(record.savedAt);
      } else {
        setResult(null);
        setOriginalResult(null);
        setScopeText(currentNotes || "");
        setIsCustomized(false);
        setSavedAt(null);
      }
    }
  }, [open, projectId, currentNotes]);

  // Query project details (notes & client_id)
  const { data: projectData } = useQuery({
    queryKey: ["project-quote-details", projectId],
    enabled: open && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, notes, client_id")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const clientId = projectData?.client_id;

  // Query notes linked to project or client
  const { data: clientNotes = [] } = useQuery({
    queryKey: ["project-quote-notes", projectId, clientId],
    enabled: open && !!projectId,
    queryFn: async () => {
      if (clientId) {
        const { data, error } = await supabase
          .from("client_notes")
          .select("id, body, created_at, project_id")
          .or(`project_id.eq.${projectId},client_id.eq.${clientId}`)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      } else {
        const { data, error } = await supabase
          .from("client_notes")
          .select("id, body, created_at, project_id")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      }
    },
  });

  // Query conversations linked to project or client
  const { data: clientConversations = [] } = useQuery({
    queryKey: ["project-quote-conversations", projectId, clientId],
    enabled: open && !!projectId,
    queryFn: async () => {
      if (clientId) {
        const { data, error } = await supabase
          .from("client_conversations")
          .select("id, subject, summary, channel, occurred_at, project_id")
          .or(`project_id.eq.${projectId},client_id.eq.${clientId}`)
          .order("occurred_at", { ascending: false });
        if (error) throw error;
        return data || [];
      } else {
        const { data, error } = await supabase
          .from("client_conversations")
          .select("id, subject, summary, channel, occurred_at, project_id")
          .eq("project_id", projectId)
          .order("occurred_at", { ascending: false });
        if (error) throw error;
        return data || [];
      }
    },
  });

  const rawProjectNotes = (projectData?.notes || currentNotes)?.trim();
  const hasProjectNotes = !!rawProjectNotes;
  const noteCount = clientNotes.length + (hasProjectNotes ? 1 : 0);
  const convoCount = clientConversations.length;
  const totalItemsCount = noteCount + convoCount;

  const handleLoadFromNotes = (specificText?: string) => {
    if (specificText !== undefined) {
      const trimmed = specificText.trim();
      if (!trimmed) {
        toast.info("Selected note or conversation has no content.");
        return;
      }
      setScopeText((prev) => (prev.trim() ? `${prev.trim()}\n\n${trimmed}` : trimmed));
      toast.success("Added to scope requirements.");
      return;
    }

    const sections: string[] = [];
    if (rawProjectNotes) {
      sections.push(`Project Notes:\n${rawProjectNotes}`);
    }

    const validNotes = clientNotes.filter((n) => n.body?.trim());
    if (validNotes.length > 0) {
      const formattedNotes = validNotes.map((n) => `• ${n.body.trim()}`).join("\n");
      sections.push(`Notes:\n${formattedNotes}`);
    }

    const validConvos = clientConversations.filter((c) => c.subject?.trim() || c.summary?.trim());
    if (validConvos.length > 0) {
      const formattedConvos = validConvos
        .map((c) => {
          const parts: string[] = [];
          if (c.subject?.trim()) parts.push(c.subject.trim());
          if (c.channel?.trim()) parts.push(`[${c.channel.trim()}]`);
          if (c.summary?.trim()) parts.push(c.summary.trim());
          return `• ${parts.join(" ")}`;
        })
        .join("\n");
      sections.push(`Conversations:\n${formattedConvos}`);
    }

    const combined = sections.join("\n\n");
    if (!combined.trim()) {
      toast.info("No project notes or conversations found.");
      return;
    }

    setScopeText((prev) => (prev.trim() ? `${prev.trim()}\n\n${combined}` : combined));
    toast.success("Loaded project notes & conversations into scope requirements.");
  };

  const currencySymbol = currency === "ZAR" ? "R" : "$";

  const handleRateCardUpdated = (newRates: ServiceRateItem[]) => {
    setRateCardItems(newRates);
    if (newRates.length > 0) {
      setHourlyRate(calculateBlendedRate(newRates));
    }
  };

  const updateResultTotals = (items: QuoteBreakdownItem[], currentRes: ProjectQuoteResult): ProjectQuoteResult => {
    let computedCost = 0;
    const serviceSummaryMap = new Map<string, { hours: number; rate: number; totalCost: number }>();

    const updatedItems = items.map((item) => {
      const hrs = Math.max(1, Number(item.hours) || 0);
      const sRate = Math.max(1, Number(item.serviceRate) || currentRes.hourlyRate || 750);
      const cost = hrs * sRate;
      computedCost += cost;

      const sName = item.serviceName || "General Development";
      const existing = serviceSummaryMap.get(sName) || { hours: 0, rate: sRate, totalCost: 0 };
      existing.hours += hrs;
      existing.totalCost += cost;
      serviceSummaryMap.set(sName, existing);

      return {
        ...item,
        hours: hrs,
        serviceRate: sRate,
        estimatedCost: cost,
      };
    });

    const totalHours = updatedItems.reduce((acc, i) => acc + i.hours, 0);
    const recHours = Math.max(1, totalHours);
    const minHours = Math.max(1, Math.round(recHours * 0.8));
    const maxHours = Math.max(recHours, Math.round(recHours * 1.25));

    const recQuote = computedCost > 0 ? computedCost : recHours * (currentRes.hourlyRate || 750);
    const blendedRate = recHours > 0 ? Math.round(recQuote / recHours) : currentRes.hourlyRate;

    const serviceBreakdown: ServiceSummaryBreakdown[] = Array.from(serviceSummaryMap.entries()).map(
      ([name, val]) => ({
        serviceName: name,
        hours: val.hours,
        rate: val.rate,
        totalCost: val.totalCost,
      })
    );

    return {
      ...currentRes,
      hourlyRate: blendedRate,
      recommendedHours: recHours,
      minHours,
      maxHours,
      recommendedQuote: recQuote,
      minQuote: Math.round(recQuote * 0.82),
      maxQuote: Math.round(recQuote * 1.25),
      lineItems: updatedItems,
      serviceBreakdown,
    };
  };

  const handleGenerate = async () => {
    if (!scopeText.trim()) {
      toast.error("Please enter a project description or requirements.");
      return;
    }

    setLoading(true);
    try {
      const res = await quoteFn({
        data: {
          projectName,
          projectType: projectType || undefined,
          scopeText: scopeText.trim(),
          hourlyRate: Number(hourlyRate) || 750,
          currency,
          serviceRates: useRateCard && rateCardItems.length > 0 ? rateCardItems : undefined,
        },
      });
      setResult(res);
      setOriginalResult(res);
      setIsCustomized(false);
      setIsAmending(false);

      // Auto-save generated quote to storage
      const rec = saveQuoteRecord(projectId, scopeText.trim(), res, res, false);
      if (rec) setSavedAt(rec.savedAt);

      toast.success("Quote generated and saved!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate quote");
    } finally {
      setLoading(false);
    }
  };

  const handleResetToAIOriginal = () => {
    if (originalResult) {
      setResult(originalResult);
      setIsCustomized(false);
      const rec = saveQuoteRecord(projectId, scopeText, originalResult, originalResult, false);
      if (rec) setSavedAt(rec.savedAt);
      toast.success("Reverted to original AI quote.");
    }
  };

  const handleClearSavedQuote = () => {
    clearQuoteRecord(projectId);
    setResult(null);
    setOriginalResult(null);
    setSavedAt(null);
    setIsCustomized(false);
    setIsAmending(false);
    toast.success("Saved quote cleared.");
  };

  // Deliverable item amendments
  const handleUpdateLineItem = (index: number, field: keyof QuoteBreakdownItem, value: any) => {
    if (!result) return;
    const newItems = [...result.lineItems];
    const target = { ...newItems[index], [field]: value };

    // If service role changed and matches rate card, update serviceRate automatically
    if (field === "serviceName") {
      const matchedCard = rateCardItems.find(
        (rc) => rc.name.toLowerCase().trim() === String(value).toLowerCase().trim()
      );
      if (matchedCard) {
        target.serviceRate = matchedCard.hourlyRate;
      }
    }

    newItems[index] = target;
    const updated = updateResultTotals(newItems, result);
    setResult(updated);
    setIsCustomized(true);

    const rec = saveQuoteRecord(projectId, scopeText, updated, originalResult || updated, true);
    if (rec) setSavedAt(rec.savedAt);
  };

  const handleAddLineItem = () => {
    if (!result) return;
    const defaultRole = rateCardItems[0]?.name || "Software Engineering";
    const defaultRate = rateCardItems[0]?.hourlyRate || result.hourlyRate || 750;

    const newItem: QuoteBreakdownItem = {
      deliverable: "Custom Deliverable / Feature",
      description: "Additional scope item added by estimator",
      hours: 8,
      serviceName: defaultRole,
      serviceRate: defaultRate,
      estimatedCost: 8 * defaultRate,
    };

    const newItems = [...result.lineItems, newItem];
    const updated = updateResultTotals(newItems, result);
    setResult(updated);
    setIsCustomized(true);

    const rec = saveQuoteRecord(projectId, scopeText, updated, originalResult || updated, true);
    if (rec) setSavedAt(rec.savedAt);
    toast.success("Added new deliverable line item.");
  };

  const handleDeleteLineItem = (index: number) => {
    if (!result) return;
    if (result.lineItems.length <= 1) {
      toast.error("At least one deliverable must remain in the quote.");
      return;
    }
    const newItems = result.lineItems.filter((_, i) => i !== index);
    const updated = updateResultTotals(newItems, result);
    setResult(updated);
    setIsCustomized(true);

    const rec = saveQuoteRecord(projectId, scopeText, updated, originalResult || updated, true);
    if (rec) setSavedAt(rec.savedAt);
    toast.success("Deliverable removed.");
  };

  // Assumptions & Risks amendments
  const handleAddAssumption = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newAssumption.trim() || !result) return;
    const updated = {
      ...result,
      assumptions: [...result.assumptions, newAssumption.trim()],
    };
    setResult(updated);
    setNewAssumption("");
    setIsCustomized(true);
    const rec = saveQuoteRecord(projectId, scopeText, updated, originalResult || updated, true);
    if (rec) setSavedAt(rec.savedAt);
  };

  const handleDeleteAssumption = (index: number) => {
    if (!result) return;
    const updated = {
      ...result,
      assumptions: result.assumptions.filter((_, i) => i !== index),
    };
    setResult(updated);
    setIsCustomized(true);
    const rec = saveQuoteRecord(projectId, scopeText, updated, originalResult || updated, true);
    if (rec) setSavedAt(rec.savedAt);
  };

  const handleAddRisk = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newRisk.trim() || !result) return;
    const updated = {
      ...result,
      risksAndNotes: [...result.risksAndNotes, newRisk.trim()],
    };
    setResult(updated);
    setNewRisk("");
    setIsCustomized(true);
    const rec = saveQuoteRecord(projectId, scopeText, updated, originalResult || updated, true);
    if (rec) setSavedAt(rec.savedAt);
  };

  const handleDeleteRisk = (index: number) => {
    if (!result) return;
    const updated = {
      ...result,
      risksAndNotes: result.risksAndNotes.filter((_, i) => i !== index),
    };
    setResult(updated);
    setIsCustomized(true);
    const rec = saveQuoteRecord(projectId, scopeText, updated, originalResult || updated, true);
    if (rec) setSavedAt(rec.savedAt);
  };

  const formatCurrencyValue = (amount: number) => {
    if (currency === "ZAR") {
      return formatZAR(amount);
    }
    return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  };

  const handleApplyToProject = async () => {
    if (!result) return;
    setApplying(true);

    try {
      // Build a markdown quote summary to append to project notes
      const quoteMarkdown = `\n\n---
### 💡 ${isCustomized ? "Amended" : "AI Generated"} Quote Estimate (${new Date().toLocaleDateString()})
- **Recommended Quote**: ${formatCurrencyValue(result.recommendedQuote)} (${result.recommendedHours} hrs @ blended ~${result.currency} ${result.hourlyRate}/hr)
- **Quote Range**: ${formatCurrencyValue(result.minQuote)} – ${formatCurrencyValue(result.maxQuote)}
- **Complexity**: ${result.complexity}
- **Estimated Timeline**: ${result.suggestedTimeline}

**Scope Breakdown:**
${result.lineItems
  .map(
    (i) =>
      `- **${i.deliverable}** (${i.hours} hrs @ ${result.currency} ${i.serviceRate || result.hourlyRate}/hr [${i.serviceName || "Dev"}] - ${formatCurrencyValue(i.estimatedCost)}): ${i.description}`
  )
  .join("\n")}

**Key Assumptions:**
${result.assumptions.map((a) => `- ${a}`).join("\n")}
`;

      const updatedNotes = currentNotes ? `${currentNotes.trim()}${quoteMarkdown}` : quoteMarkdown.trim();

      const { error } = await supabase
        .from("projects")
        .update({
          opportunity_value: result.recommendedQuote,
          notes: updatedNotes,
        })
        .eq("id", projectId);

      if (error) throw error;

      // Save record to persistent storage
      const rec = saveQuoteRecord(projectId, scopeText, result, originalResult || result, isCustomized);
      if (rec) setSavedAt(rec.savedAt);

      toast.success(`Updated project value to ${formatCurrencyValue(result.recommendedQuote)} and saved quote!`);
      if (onQuoteApplied) {
        onQuoteApplied(result.recommendedQuote, updatedNotes);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save quote to project");
    } finally {
      setApplying(false);
    }
  };

  const handleCopyQuote = () => {
    if (!result) return;
    const text = `PROJECT PRICE QUOTE & ESTIMATE${isCustomized ? " (AMENDED)" : ""}: ${projectName}
==================================================
Total Recommended Quote: ${formatCurrencyValue(result.recommendedQuote)}
Total Estimated Effort: ${result.recommendedHours} Hours (Effective Blended: ${result.currency} ${result.hourlyRate}/hr)
Estimated Timeline: ${result.suggestedTimeline}
Complexity: ${result.complexity}

SERVICE EFFORT BREAKDOWN:
--------------------------------------------------
${(result.serviceBreakdown || [])
  .map((s) => `• ${s.serviceName}: ${s.hours} hrs @ ${result.currency} ${s.rate}/hr = ${formatCurrencyValue(s.totalCost)}`)
  .join("\n")}

SCOPE & DELIVERABLES BREAKDOWN:
--------------------------------------------------
${result.lineItems
  .map(
    (item, idx) =>
      `${idx + 1}. ${item.deliverable} (${item.hours} hrs @ ${result.currency} ${item.serviceRate || result.hourlyRate}/hr [${item.serviceName || "Service"}] - ${formatCurrencyValue(item.estimatedCost)})\n   ${item.description}`
  )
  .join("\n\n")}

ASSUMPTIONS:
--------------------------------------------------
${result.assumptions.map((a) => `• ${a}`).join("\n")}

RISKS & CAVEATS:
--------------------------------------------------
${result.risksAndNotes.map((r) => `• ${r}`).join("\n")}
`;

    navigator.clipboard.writeText(text);
    toast.success("Quote breakdown copied to clipboard!");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calculator className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="font-display text-xl font-semibold">
                  AI Quote & Price Estimator
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Describe project work to receive an AI-powered effort estimation & cost quote for <strong className="text-foreground">{projectName}</strong>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 my-2">
            {/* Saved Quote Banner */}
            {savedAt && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-primary/10 border border-primary/20 p-3 rounded-xl text-xs text-foreground animate-in fade-in-50 duration-200">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <span className="font-semibold text-primary">Saved Quote Loaded</span>
                    <span className="text-muted-foreground ml-1.5 text-[11px]">
                      (Last updated {formatDistanceToNow(new Date(savedAt), { addSuffix: true })})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAmending(true)}
                    className="h-7 text-[11px] gap-1 border-primary/30 text-primary"
                  >
                    <Pencil className="h-3 w-3" /> Edit Quote
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSavedQuote}
                    className="h-7 text-[11px] text-destructive hover:bg-destructive/10 gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Clear Quote
                  </Button>
                </div>
              </div>
            )}

            {/* Input Form Section */}
            <div className="space-y-3 bg-paper-soft/50 rounded-xl p-4 border border-border/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="scope-text" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Work Description & Scope Requirements
                </Label>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLoadFromNotes()}
                    className="h-7 text-[11px] font-mono text-primary hover:bg-primary/10 gap-1 px-2"
                  >
                    <FolderSync className="h-3 w-3" />
                    Load from project notes & conversations
                    {totalItemsCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px] font-mono">
                        {totalItemsCount}
                      </Badge>
                    )}
                  </Button>

                  {totalItemsCount > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-6 p-0 text-primary hover:bg-primary/10">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-y-auto">
                        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                          Select Source to Insert
                        </DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => handleLoadFromNotes()} className="gap-2 cursor-pointer">
                          <FolderSync className="h-3.5 w-3.5 text-primary" />
                          <span className="font-medium">Load All ({totalItemsCount} items)</span>
                        </DropdownMenuItem>

                        {hasProjectNotes && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Project Notes
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              onSelect={() => handleLoadFromNotes(rawProjectNotes)}
                              className="gap-2 cursor-pointer"
                            >
                              <Notebook className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              <span className="truncate text-xs font-mono">
                                {rawProjectNotes.slice(0, 45)}...
                              </span>
                            </DropdownMenuItem>
                          </>
                        )}

                        {clientNotes.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Notes ({clientNotes.length})
                            </DropdownMenuLabel>
                            {clientNotes.slice(0, 10).map((n) => (
                              <DropdownMenuItem
                                key={n.id}
                                onSelect={() => handleLoadFromNotes(n.body)}
                                className="gap-2 cursor-pointer"
                              >
                                <StickyNote className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="truncate text-xs">{n.body ? n.body.slice(0, 40) : "Note"}</span>
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}

                        {clientConversations.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Conversations ({clientConversations.length})
                            </DropdownMenuLabel>
                            {clientConversations.slice(0, 10).map((c) => {
                              const parts: string[] = [];
                              if (c.subject?.trim()) parts.push(c.subject.trim());
                              if (c.summary?.trim()) parts.push(c.summary.trim());
                              const convoText = parts.join(": ") || "Conversation";
                              return (
                                <DropdownMenuItem
                                  key={c.id}
                                  onSelect={() => handleLoadFromNotes(convoText)}
                                  className="gap-2 cursor-pointer"
                                >
                                  <MessageSquare className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                  <span className="truncate text-xs">{c.subject || c.summary || "Conversation"}</span>
                                </DropdownMenuItem>
                              );
                            })}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              <Textarea
                id="scope-text"
                value={scopeText}
                onChange={(e) => setScopeText(e.target.value)}
                placeholder="e.g. Build a 5-page responsive marketing website for a legal firm with contact forms, blog CMS, client portal login integration, and SEO optimization..."
                rows={4}
                className="text-sm resize-y"
              />

              {/* Rate Card Banner & Controls */}
              <div className="rounded-lg border border-border bg-card p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Rate Strategy</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setUseRateCard(true)}
                      className={`text-[11px] font-mono px-2.5 py-1 rounded-md transition ${
                        useRateCard
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Multi-Service Rate Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseRateCard(false)}
                      className={`text-[11px] font-mono px-2.5 py-1 rounded-md transition ${
                        !useRateCard
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Single Flat Rate
                    </button>
                  </div>
                </div>

                {useRateCard ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {rateCardItems.slice(0, 4).map((item) => (
                          <Badge key={item.id} variant="outline" className="text-[10px] font-mono bg-muted/30">
                            {item.name.split(" ")[0]}: {currencySymbol}{item.hourlyRate}/h
                          </Badge>
                        ))}
                        {rateCardItems.length > 4 && (
                          <Badge variant="outline" className="text-[10px] font-mono bg-muted/30">
                            +{rateCardItems.length - 4} more
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        AI will match deliverables to specialized service rates (Blended avg: <strong className="text-foreground">{currencySymbol} {hourlyRate}/hr</strong>)
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRateCardManagerOpen(true)}
                      className="gap-1.5 text-xs shrink-0 h-8"
                    >
                      <Settings2 className="h-3.5 w-3.5 text-primary" /> Manage Rate Card
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label htmlFor="hourly-rate" className="text-xs text-muted-foreground">
                        Flat Hourly Rate
                      </Label>
                      <div className="relative mt-1">
                        <Input
                          id="hourly-rate"
                          type="number"
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
                          className="pl-7"
                        />
                        <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground font-mono">
                          {currencySymbol}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-end pb-0.5">
                      <p className="text-[11px] text-muted-foreground">
                        All deliverables calculated at flat {currencySymbol} {hourlyRate}/hour.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <Label htmlFor="currency-select" className="text-xs text-muted-foreground">
                    Currency
                  </Label>
                  <select
                    id="currency-select"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="ZAR">ZAR (R)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>

                <div className="sm:col-span-2 flex items-end">
                  <Button
                    type="button"
                    onClick={handleGenerate}
                    disabled={loading || !scopeText.trim()}
                    className="w-full gap-2 h-10"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Analyzing Scope & Service Rates...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-amber-300" /> Calculate Project Quote
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Generated Quote Result Section */}
            {result && (
              <div className="space-y-5 animate-in fade-in-50 duration-300">
                {/* Result Header & Amendment Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/40 p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                      Quote Estimation Output
                    </span>
                    {isCustomized ? (
                      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-[10px]">
                        <Pencil className="h-3 w-3" /> Amended by User
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1">
                        <BadgeCheck className="h-3 w-3" /> AI Generated
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isCustomized && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResetToAIOriginal}
                        className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Revert to AI
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant={isAmending ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIsAmending(!isAmending)}
                      className="h-8 text-xs gap-1.5"
                    >
                      {isAmending ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Finish Amending
                        </>
                      ) : (
                        <>
                          <Edit3 className="h-3.5 w-3.5 text-primary" /> Amend Quote
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Highlight Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>Recommended Quote</span>
                      <DollarSign className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="mt-2">
                      <p className="text-2xl font-display font-bold text-foreground">
                        {formatCurrencyValue(result.recommendedQuote)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                        {result.recommendedHours} hrs @ blended ~{result.currency} {result.hourlyRate}/hr
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>Quote Range</span>
                      <Layers className="h-3.5 w-3.5" />
                    </div>
                    <div className="mt-2">
                      <p className="text-lg font-display font-semibold text-foreground">
                        {formatCurrencyValue(result.minQuote)} – {formatCurrencyValue(result.maxQuote)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                        {result.minHours} – {result.maxHours} total hours
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>Timeline & Complexity</span>
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                    <div className="mt-2">
                      {isAmending ? (
                        <div className="space-y-1.5">
                          <Input
                            value={result.suggestedTimeline}
                            onChange={(e) => {
                              setResult({ ...result, suggestedTimeline: e.target.value });
                              setIsCustomized(true);
                            }}
                            className="h-7 text-xs"
                            placeholder="e.g. 4-6 Weeks"
                          />
                          <select
                            value={result.complexity}
                            onChange={(e) => {
                              setResult({ ...result, complexity: e.target.value });
                              setIsCustomized(true);
                            }}
                            className="w-full h-7 rounded border border-input bg-background px-2 text-xs"
                          >
                            <option value="Low">Low Complexity</option>
                            <option value="Medium">Medium Complexity</option>
                            <option value="High">High Complexity</option>
                            <option value="Enterprise">Enterprise</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-base font-semibold text-foreground">
                              {result.suggestedTimeline}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Estimated turnaround
                            </p>
                          </div>
                          <Badge
                            variant={
                              result.complexity === "High" || result.complexity === "Enterprise"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {result.complexity}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Service Breakdown Summary Bar (if rate card was used) */}
                {result.serviceBreakdown && result.serviceBreakdown.length > 0 && (
                  <div className="bg-paper p-3 rounded-lg border border-border/80 space-y-2">
                    <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider font-semibold">
                      Service Effort Allocation (Rate Card)
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {result.serviceBreakdown.map((s, idx) => (
                        <div key={idx} className="bg-card border border-border px-2.5 py-1.5 rounded-md text-xs flex items-center gap-2">
                          <span className="font-medium text-foreground">{s.serviceName}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {s.hours}h @ {result.currency} {s.rate}/h = <strong className="text-foreground">{formatCurrencyValue(s.totalCost)}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary Description */}
                <div className="text-xs text-muted-foreground leading-relaxed bg-paper p-3 rounded-lg border border-border/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-foreground">Scope & Technical Analysis</strong>
                  </div>
                  {isAmending ? (
                    <Textarea
                      value={result.summary}
                      onChange={(e) => {
                        setResult({ ...result, summary: e.target.value });
                        setIsCustomized(true);
                      }}
                      rows={2}
                      className="text-xs mt-1"
                    />
                  ) : (
                    <p>{result.summary}</p>
                  )}
                </div>

                {/* Scope Breakdown Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Deliverables & Service Rate Breakdown
                    </h4>
                    {isAmending && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddLineItem}
                        className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Deliverable
                      </Button>
                    )}
                  </div>

                  <div className="rounded-lg border border-border overflow-hidden bg-card text-xs">
                    <div className="grid grid-cols-12 bg-muted/50 p-2.5 font-mono text-[11px] text-muted-foreground border-b border-border items-center">
                      <span className="col-span-4 font-semibold">Deliverable / Milestone</span>
                      <span className="col-span-3 font-semibold">Service Role & Rate</span>
                      <span className="col-span-3 font-semibold">Description</span>
                      <span className="col-span-1 text-center font-semibold">Hours</span>
                      <span className="col-span-1 text-right font-semibold">Cost</span>
                    </div>

                    <div className="divide-y divide-border">
                      {result.lineItems.map((item, idx) => (
                        <div key={idx} className="p-2.5 hover:bg-paper-soft/40 transition">
                          {isAmending ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-4">
                                  <Input
                                    value={item.deliverable}
                                    onChange={(e) => handleUpdateLineItem(idx, "deliverable", e.target.value)}
                                    placeholder="Deliverable title"
                                    className="h-8 text-xs font-medium"
                                  />
                                </div>

                                <div className="col-span-3 flex items-center gap-1">
                                  <select
                                    value={item.serviceName || ""}
                                    onChange={(e) => handleUpdateLineItem(idx, "serviceName", e.target.value)}
                                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-[11px]"
                                  >
                                    <option value="">Custom Service</option>
                                    {rateCardItems.map((rc) => (
                                      <option key={rc.id} value={rc.name}>
                                        {rc.name} ({currencySymbol}{rc.hourlyRate}/h)
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="col-span-3 flex items-center gap-1">
                                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">{currencySymbol}</span>
                                  <Input
                                    type="number"
                                    value={item.serviceRate || result.hourlyRate}
                                    onChange={(e) => handleUpdateLineItem(idx, "serviceRate", Number(e.target.value) || 0)}
                                    className="h-8 text-xs font-mono"
                                    placeholder="Rate/hr"
                                  />
                                  <span className="text-[10px] text-muted-foreground shrink-0">/hr</span>
                                </div>

                                <div className="col-span-1 flex items-center justify-center">
                                  <Input
                                    type="number"
                                    value={item.hours}
                                    onChange={(e) => handleUpdateLineItem(idx, "hours", Number(e.target.value) || 0)}
                                    className="h-8 text-xs font-mono text-center px-1"
                                  />
                                </div>

                                <div className="col-span-1 flex items-center justify-end gap-1">
                                  <span className="font-mono font-semibold text-xs text-foreground shrink-0">
                                    {formatCurrencyValue(item.estimatedCost)}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteLineItem(idx)}
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>

                              <div>
                                <Input
                                  value={item.description}
                                  onChange={(e) => handleUpdateLineItem(idx, "description", e.target.value)}
                                  placeholder="Deliverable details and scope description..."
                                  className="h-7 text-[11px] text-muted-foreground"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-12 items-center">
                              <span className="col-span-4 font-medium text-foreground pr-2">{item.deliverable}</span>
                              <div className="col-span-3 pr-2">
                                <Badge variant="outline" className="text-[10px] font-mono bg-muted/40 text-foreground">
                                  {item.serviceName || "Dev"} ({result.currency} {item.serviceRate || result.hourlyRate}/h)
                                </Badge>
                              </div>
                              <span className="col-span-3 text-muted-foreground truncate pr-2">{item.description}</span>
                              <span className="col-span-1 text-center font-mono text-muted-foreground">{item.hours}h</span>
                              <span className="col-span-1 text-right font-mono font-medium text-foreground">
                                {formatCurrencyValue(item.estimatedCost)}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-12 p-2.5 bg-muted/30 font-semibold border-t border-border">
                      <span className="col-span-9 text-right font-mono text-muted-foreground">Total Recommended Quote:</span>
                      <span className="col-span-3 text-right font-mono text-primary text-sm">
                        {formatCurrencyValue(result.recommendedQuote)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Assumptions & Risks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Assumptions */}
                  <div className="rounded-lg border border-border/80 bg-paper p-3 space-y-2">
                    <p className="font-semibold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Key Assumptions
                      </span>
                    </p>

                    <ul className="space-y-1 text-muted-foreground leading-snug">
                      {result.assumptions.map((a, i) => (
                        <li key={i} className="flex items-center justify-between gap-1 group">
                          <span className="text-[11px]">• {a}</span>
                          {isAmending && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAssumption(i)}
                              className="text-muted-foreground hover:text-destructive opacity-80 group-hover:opacity-100 transition"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>

                    {isAmending && (
                      <form onSubmit={handleAddAssumption} className="flex items-center gap-1 pt-1">
                        <Input
                          value={newAssumption}
                          onChange={(e) => setNewAssumption(e.target.value)}
                          placeholder="Add assumption..."
                          className="h-7 text-[11px]"
                        />
                        <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                          Add
                        </Button>
                      </form>
                    )}
                  </div>

                  {/* Risks */}
                  <div className="rounded-lg border border-border/80 bg-paper p-3 space-y-2">
                    <p className="font-semibold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Risks & Notes
                      </span>
                    </p>

                    <ul className="space-y-1 text-muted-foreground leading-snug">
                      {result.risksAndNotes.map((r, i) => (
                        <li key={i} className="flex items-center justify-between gap-1 group">
                          <span className="text-[11px]">• {r}</span>
                          {isAmending && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRisk(i)}
                              className="text-muted-foreground hover:text-destructive opacity-80 group-hover:opacity-100 transition"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>

                    {isAmending && (
                      <form onSubmit={handleAddRisk} className="flex items-center gap-1 pt-1">
                        <Input
                          value={newRisk}
                          onChange={(e) => setNewRisk(e.target.value)}
                          placeholder="Add risk/note..."
                          className="h-7 text-[11px]"
                        />
                        <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                          Add
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 border-t border-border pt-3 mt-2">
            {result && (
              <Button variant="outline" type="button" onClick={handleCopyQuote} className="gap-1.5 text-xs">
                <Copy className="h-3.5 w-3.5" /> Copy Quote Text
              </Button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} className="text-xs">
                Close
              </Button>

              {result && (
                <Button type="button" onClick={handleApplyToProject} disabled={applying} className="gap-1.5 text-xs">
                  {applying ? "Applying..." : "Apply Quote to Project"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RateCardManagerDialog
        open={rateCardManagerOpen}
        onOpenChange={setRateCardManagerOpen}
        currency={currency}
        onCardUpdated={handleRateCardUpdated}
      />
    </>
  );
}

