import React, { useState } from "react";
import { useCredentialSystems } from "@/lib/credential-systems";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Check, X } from "lucide-react";

interface SystemSelectProps {
  value: string;
  onChange: (value: string) => void;
  existingDbSystems?: string[];
  id?: string;
  className?: string;
}

export function SystemSelect({
  value,
  onChange,
  existingDbSystems,
  id,
  className = "",
}: SystemSelectProps) {
  const { systems, addSystem } = useCredentialSystems(existingDbSystems);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__add_new__") {
      setAddingCustom(true);
      setCustomInput("");
    } else {
      onChange(val);
    }
  };

  const handleAddCustom = () => {
    if (customInput.trim()) {
      const added = addSystem(customInput.trim());
      onChange(added);
      setCustomInput("");
      setAddingCustom(false);
    }
  };

  if (addingCustom) {
    return (
      <div className={`flex items-center gap-1.5 mt-1 ${className}`}>
        <Input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="e.g. TikTok, WordPress, AWS"
          className="h-10 text-sm"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddCustom();
            } else if (e.key === "Escape") {
              setAddingCustom(false);
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          className="h-10 px-3 shrink-0"
          disabled={!customInput.trim()}
          onClick={handleAddCustom}
        >
          <Check className="h-4 w-4 mr-1" /> Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-10 px-2 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setAddingCustom(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Determine matched option using case-insensitive check
  const matchedSystem = systems.find(
    (s) => s.toLowerCase() === (value || "").trim().toLowerCase()
  );
  const selectedValue = matchedSystem || value;

  // Build unique options list
  const uniqueMap = new Map<string, string>();
  for (const sys of systems) {
    if (sys && sys.trim()) {
      uniqueMap.set(sys.trim().toLowerCase(), sys.trim());
    }
  }
  if (value && value.trim() && !uniqueMap.has(value.trim().toLowerCase())) {
    uniqueMap.set(value.trim().toLowerCase(), value.trim());
  }

  const allOptions = Array.from(uniqueMap.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  return (
    <div className="relative mt-1">
      <select
        id={id}
        value={selectedValue}
        onChange={handleSelectChange}
        className={`h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
      >
        <option value="">— Select System —</option>
        {allOptions.map((sys) => (
          <option key={sys} value={sys}>
            {sys}
          </option>
        ))}
        <option value="__add_new__" className="font-semibold text-primary">
          + Add new system...
        </option>
      </select>
    </div>
  );
}
