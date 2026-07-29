import { useState, useEffect } from "react";
import { FormErrorAlert } from "@/components/FormErrorAlert";
import {
  ServiceRateItem,
  getStoredRateCard,
  saveStoredRateCard,
  resetRateCardToDefaults,
  calculateBlendedRate,
} from "@/lib/rate-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  CreditCard,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  Edit2,
  DollarSign,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface RateCardManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency?: string;
  onCardUpdated?: (rates: ServiceRateItem[]) => void;
}

export function RateCardManagerDialog({
  open,
  onOpenChange,
  currency = "ZAR",
  onCardUpdated,
}: RateCardManagerDialogProps) {
  const [rates, setRates] = useState<ServiceRateItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // New item form state
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Engineering");
  const [newRate, setNewRate] = useState<number>(850);
  const [newDesc, setNewDesc] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const currencySymbol = currency === "ZAR" ? "R" : "$";

  useEffect(() => {
    if (open) {
      setRates(getStoredRateCard());
    }
  }, [open]);

  const handleUpdateItem = (id: string, key: keyof ServiceRateItem, value: any) => {
    const updated = rates.map((r) => (r.id === id ? { ...r, [key]: value } : r));
    setRates(updated);
  };

  const handleSaveAll = () => {
    saveStoredRateCard(rates);
    toast.success("Service Rate Card saved successfully!");
    if (onCardUpdated) onCardUpdated(rates);
    onOpenChange(false);
  };

  const handleReset = () => {
    const defaults = resetRateCardToDefaults();
    setRates(defaults);
    toast.success("Reset Rate Card to standard agency defaults.");
    if (onCardUpdated) onCardUpdated(defaults);
  };

  const handleDelete = (id: string) => {
    if (rates.length <= 1) {
      toast.error("At least one service role must remain in the Rate Card.");
      return;
    }
    const filtered = rates.filter((r) => r.id !== id);
    setRates(filtered);
    toast.success("Service role removed.");
  };

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!newName.trim()) {
      const msg = "Please provide a service role name.";
      setAddError(msg);
      toast.error(msg);
      return;
    }

    if (!newRate || newRate <= 0) {
      const msg = "Please provide a valid hourly rate greater than 0.";
      setAddError(msg);
      toast.error(msg);
      return;
    }

    const newItem: ServiceRateItem = {
      id: `custom-rate-${Date.now()}`,
      name: newName.trim(),
      category: newCategory.trim() || "General",
      hourlyRate: Number(newRate) || 800,
      description: newDesc.trim() || "Custom agency service offer.",
    };

    const updated = [...rates, newItem];
    setRates(updated);
    setShowAddForm(false);
    setNewName("");
    setNewDesc("");
    setNewRate(850);
    setAddError(null);
    toast.success(`Added ${newItem.name} to Rate Card.`);
  };

  const blendedAverage = calculateBlendedRate(rates);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-display text-xl font-semibold">
                  Service Rate Card Manager
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Manage hourly rate cards for specialized agency services. These inform your final AI project quotes.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Header Metrics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-paper-soft/60 p-3.5 rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-mono text-muted-foreground uppercase">Configured Roles</p>
                <p className="text-base font-semibold text-foreground">{rates.length} Service Tiers</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600">
                <DollarSign className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-mono text-muted-foreground uppercase">Blended Rate Avg</p>
                <p className="text-base font-semibold text-foreground">
                  {currencySymbol} {blendedAverage} / hr
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="gap-1.5 text-xs h-8"
              >
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" /> Reset Defaults
              </Button>
            </div>
          </div>

          {/* Add Service Button / Form */}
          {!showAddForm ? (
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Managed Service Tiers
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShowAddForm(true)}
                className="gap-1.5 text-xs h-8"
              >
                <Plus className="h-3.5 w-3.5" /> Add Service Tier
              </Button>
            </div>
          ) : (
            <form onSubmit={handleAddService} className="bg-paper p-3.5 rounded-xl border border-primary/40 space-y-3 animate-in fade-in-50">
              <FormErrorAlert error={addError} onDismiss={() => setAddError(null)} title="Failed to add service tier" />
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> New Service Tier
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                  className="h-6 text-xs"
                >
                  Cancel
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Service Name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. AI & Data Pipeline Architecture"
                    className="mt-1 h-8 text-xs"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Design">Design</option>
                    <option value="AI & Analytics">AI & Analytics</option>
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Management">Management</option>
                    <option value="Quality Assurance">Quality Assurance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Hourly Rate ({currencySymbol})</Label>
                  <Input
                    type="number"
                    value={newRate}
                    onChange={(e) => setNewRate(Number(e.target.value) || 0)}
                    className="mt-1 h-8 text-xs"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Short Description</Label>
                  <Input
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Brief description of work scope covered under this rate..."
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button type="submit" size="sm" className="gap-1 text-xs h-8">
                  <Plus className="h-3.5 w-3.5" /> Save Service Tier
                </Button>
              </div>
            </form>
          )}

          {/* Rate Card Table / List */}
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {rates.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/40 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono bg-muted/40">
                        {item.category}
                      </Badge>
                      <span className="font-semibold text-sm text-foreground">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 font-mono font-bold text-sm text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                        <span>{currencySymbol}</span>
                        <Input
                          type="number"
                          value={item.hourlyRate}
                          onChange={(e) =>
                            handleUpdateItem(item.id, "hourlyRate", Number(e.target.value) || 0)
                          }
                          className="w-20 h-7 text-xs font-bold text-right p-1 bg-background border-border"
                        />
                        <span className="text-xs font-normal text-muted-foreground">/hr</span>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Delete tier"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Description field */}
                  <div>
                    <Input
                      value={item.description}
                      onChange={(e) => handleUpdateItem(item.id, "description", e.target.value)}
                      placeholder="Service description..."
                      className="text-xs h-7 text-muted-foreground bg-muted/20 border-transparent hover:border-border focus:border-border"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 border-t border-border pt-3">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button type="button" onClick={handleSaveAll} className="gap-1.5 text-xs">
            <Check className="h-3.5 w-3.5" /> Save Rate Card Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
