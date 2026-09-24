import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  generateOnePagePitch,
  type ResearchedBusiness,
  type PitchResponse,
} from "@/lib/pipeline-ai.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import {
  FileText,
  Copy,
  Check,
  Sparkles,
  Loader2,
  Download,
  Building2,
  Globe,
  Coins,
  Save,
  RotateCcw,
  Printer,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

interface PipelinePitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  business: ResearchedBusiness | null;
}

type PitchTone = "professional" | "bold_conversion" | "friendly_consultative";

export function PipelinePitchDialog({
  open,
  onOpenChange,
  business,
}: PipelinePitchDialogProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const pitchFn = useServerFn(generateOnePagePitch);

  const [tone, setTone] = useState<PitchTone>("professional");
  const [pitch, setPitch] = useState<PitchResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Auto-generate when opened with a new business
  useEffect(() => {
    if (open && business) {
      handleGeneratePitch(tone);
    } else if (!open) {
      setPitch(null);
    }
  }, [open, business]);

  const handleGeneratePitch = async (selectedTone: PitchTone = tone) => {
    if (!business) return;

    setIsGenerating(true);
    setPitch(null);

    try {
      const result = await pitchFn({
        data: {
          businessName: business.businessName,
          industry: business.industry,
          location: business.location,
          websiteUrl: business.websiteUrl,
          currentIssues: business.currentIssues,
          proposedServices: business.proposedServices,
          estimatedValue: business.estimatedValue,
          pitchStrategy: business.pitchStrategy,
          tone: selectedTone,
        },
      });

      setPitch(result);
      toast.success(`Generated 1-Page Pitch Proposal for ${business.businessName}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Pitch generation failed: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPitch = () => {
    if (!pitch) return;
    const fullText = `Subject: ${pitch.subjectLine}\n\n${pitch.pitchMarkdown}`;
    navigator.clipboard.writeText(fullText);
    setIsCopied(true);
    toast.success("Copied 1-page pitch proposal to clipboard!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadPitch = () => {
    if (!pitch || !business) return;
    const element = document.createElement("a");
    const file = new Blob([`Subject: ${pitch.subjectLine}\n\n${pitch.pitchMarkdown}`], {
      type: "text/markdown",
    });
    element.href = URL.createObjectURL(file);
    element.download = `Pitch-Proposal-${business.businessName.replace(/[^a-zA-Z0-9]/g, "-")}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Downloaded pitch proposal as Markdown file");
  };

  const handleSaveToProjectNotes = async () => {
    if (!pitch || !business) return;
    setIsSavingNote(true);

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

      // 2. Check or create Project in Lead stage
      let projectId: string | null = null;
      const { data: existingProjects } = await supabase
        .from("projects")
        .select("id")
        .eq("client_id", clientId)
        .ilike("name", `%${business.businessName}%`)
        .limit(1);

      if (existingProjects && existingProjects.length > 0) {
        projectId = existingProjects[0].id;
      } else {
        const { data: newProj, error: projErr } = await supabase
          .from("projects")
          .insert({
            name: `${business.businessName} Website Redesign`,
            client_id: clientId,
            status: "lead",
            opportunity_value: business.estimatedValue,
            project_type: "website",
            notes: `### 🌐 Website Audit\nWebsite: ${business.websiteUrl}\nEst. Value: ZAR ${business.estimatedValue.toLocaleString()}`,
            created_by: user?.id ?? null,
          })
          .select("id")
          .single();

        if (projErr) throw new Error(`Could not create project: ${projErr.message}`);
        projectId = newProj.id;
      }

      // 3. Save Pitch into project_notes table
      const { error: noteErr } = await supabase.from("project_notes").insert({
        project_id: projectId,
        content: `# 📄 1-Page Pitch Proposal\n**Subject:** ${pitch.subjectLine}\n\n${pitch.pitchMarkdown}`,
        created_by: user?.id ?? null,
      });

      if (noteErr) throw new Error(`Could not save project note: ${noteErr.message}`);

      toast.success(`Saved Pitch Proposal to Project Notes for ${business.businessName}!`);

      qc.invalidateQueries({ queryKey: ["projects", "pipeline"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project_notes"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setIsSavingNote(false);
    }
  };

  if (!business) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-2xl border-border shadow-2xl">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  1-Page Client Pitch Proposal
                </DialogTitle>
                <DialogDescription className="text-xs text-indigo-200/80">
                  Custom AI proposal tailored for <span className="font-semibold text-white">{business.businessName}</span> ({business.industry})
                </DialogDescription>
              </div>
            </div>

            {/* Value Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
              <Coins className="h-3.5 w-3.5" /> ZAR {business.estimatedValue.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Toolbar Bar */}
        <div className="p-3 bg-muted/40 border-b border-border/80 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          {/* Tone Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium">Pitch Style:</span>
            {[
              { id: "professional", label: "Professional" },
              { id: "bold_conversion", label: "Bold & Direct (ROI)" },
              { id: "friendly_consultative", label: "Consultative" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTone(item.id as PitchTone);
                  handleGeneratePitch(item.id as PitchTone);
                }}
                disabled={isGenerating}
                className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all cursor-pointer ${
                  tone === item.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-background hover:bg-accent border-border text-muted-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGeneratePitch(tone)}
              disabled={isGenerating}
              className="h-8 text-xs gap-1 cursor-pointer"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isGenerating ? "animate-spin" : ""}`} /> Regenerate
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPitch}
              disabled={!pitch || isGenerating}
              className="h-8 text-xs gap-1 cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy Pitch
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPitch}
              disabled={!pitch || isGenerating}
              className="h-8 text-xs gap-1 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Export .md
            </Button>

            <Button
              size="sm"
              onClick={handleSaveToProjectNotes}
              disabled={!pitch || isGenerating || isSavingNote}
              className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm cursor-pointer"
            >
              {isSavingNote ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" /> Save to Project Notes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Scrollable Pitch Document Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950/50">
          {isGenerating ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-4 rounded-full bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 animate-bounce">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-semibold text-foreground">Drafting 1-Page Pitch Proposal</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Tailoring audit insights, value metrics, and redesign roadmap for <span className="font-semibold text-indigo-600 dark:text-indigo-400">{business.businessName}</span>...
                </p>
              </div>
            </div>
          ) : pitch ? (
            <div className="max-w-2xl mx-auto bg-card text-card-foreground p-8 rounded-xl shadow-lg border border-border/80 space-y-6">
              {/* Document Header */}
              <div className="border-b border-border pb-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Client Proposal & Strategy Brief
                  </span>
                  <span>{business.location}</span>
                </div>
                <h2 className="text-xl font-bold text-foreground">{business.businessName}</h2>
                <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs">
                  <span className="font-bold text-indigo-950 dark:text-indigo-200 block mb-0.5">
                    Suggested Subject Line:
                  </span>
                  <span className="text-foreground font-medium">{pitch.subjectLine}</span>
                </div>
              </div>

              {/* Pitch Content in Markdown */}
              <div className="text-sm space-y-4 leading-relaxed">
                <Markdown>{pitch.pitchMarkdown}</Markdown>
              </div>

              {/* Document Footer */}
              <div className="pt-6 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" /> {business.websiteUrl}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" /> {business.industry}
                  </span>
                </div>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Est. Scope: ZAR {business.estimatedValue.toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground text-xs">
              No pitch generated yet. Click regenerate to build a 1-page proposal.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
