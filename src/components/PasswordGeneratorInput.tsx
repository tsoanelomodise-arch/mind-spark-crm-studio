import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Eye, EyeOff, Sparkles, Copy, Check, Settings2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  generateRandomPassword,
  evaluatePasswordStrength,
  type PasswordGeneratorOptions,
} from "@/lib/password-generator";

export interface PasswordGeneratorInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  hint?: React.ReactNode;
  autoComplete?: string;
  showStrength?: boolean;
  onGenerated?: (password: string) => void;
}

export function PasswordGeneratorInput({
  id = "password-generator-input",
  label = "Password",
  value,
  onChange,
  placeholder = "Enter or auto-generate password",
  required = false,
  disabled = false,
  className = "",
  inputClassName = "",
  hint,
  autoComplete = "new-password",
  showStrength = true,
  onGenerated,
}: PasswordGeneratorInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState<PasswordGeneratorOptions>({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    avoidAmbiguous: false,
  });

  const strength = evaluatePasswordStrength(value);

  const handleGenerate = (customOptions?: Partial<PasswordGeneratorOptions>) => {
    const mergedOptions = { ...options, ...(customOptions || {}) };
    const newPwd = generateRandomPassword(mergedOptions);
    onChange(newPwd);
    setShowPassword(true);
    onGenerated?.(newPwd);
    toast.success("Random password generated & inserted", {
      description: "Password is ready to be encrypted and saved with this login.",
    });
  };

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Password copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy password");
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id} className="text-xs font-semibold">
            {label}
            {required && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          {hint && <span className="text-[11px] text-muted-foreground font-normal">{hint}</span>}
        </div>

        <div className="flex items-center gap-1">
          {/* Quick Auto-generate Button */}
          <Button
            id={`${id}-generate-btn`}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleGenerate()}
            disabled={disabled}
            className="h-6 px-2 text-[11px] font-semibold text-primary hover:text-primary/90 hover:bg-primary/10 gap-1 rounded-lg transition-colors"
            title="Auto-generate a secure random password and insert it into the field"
          >
            <Sparkles className="h-3 w-3" />
            <span>Auto-generate</span>
          </Button>

          {/* Generator options popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-lg"
                title="Password generation settings"
              >
                <Settings2 className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3 text-xs space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-semibold text-foreground">Generator Settings</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {options.length ?? 16} chars
                </span>
              </div>

              {/* Length selector */}
              <div>
                <Label className="text-[11px] text-muted-foreground">Length</Label>
                <div className="grid grid-cols-4 gap-1 mt-1">
                  {[12, 16, 20, 24].map((len) => (
                    <Button
                      key={len}
                      type="button"
                      variant={options.length === len ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setOptions((prev) => ({ ...prev, length: len }));
                        handleGenerate({ length: len });
                      }}
                      className="h-7 text-xs font-mono"
                    >
                      {len}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Include Symbols (!@#$)</span>
                  <input
                    type="checkbox"
                    checked={options.includeSymbols}
                    onChange={(e) => {
                      const includeSymbols = e.target.checked;
                      setOptions((prev) => ({ ...prev, includeSymbols }));
                      handleGenerate({ includeSymbols });
                    }}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Include Numbers (0-9)</span>
                  <input
                    type="checkbox"
                    checked={options.includeNumbers}
                    onChange={(e) => {
                      const includeNumbers = e.target.checked;
                      setOptions((prev) => ({ ...prev, includeNumbers }));
                      handleGenerate({ includeNumbers });
                    }}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Avoid ambiguous (I, l, 0, O)</span>
                  <input
                    type="checkbox"
                    checked={options.avoidAmbiguous}
                    onChange={(e) => {
                      const avoidAmbiguous = e.target.checked;
                      setOptions((prev) => ({ ...prev, avoidAmbiguous }));
                      handleGenerate({ avoidAmbiguous });
                    }}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                </label>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => handleGenerate()}
                className="w-full h-7 text-xs gap-1.5 mt-2"
              >
                <RefreshCw className="h-3 w-3" />
                Regenerate now
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`h-10 pr-24 font-mono text-sm rounded-xl border-border bg-background shadow-2xs ${inputClassName}`}
        />

        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {/* Quick inline regenerate button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleGenerate()}
            disabled={disabled}
            className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
            title="Auto-generate another random password"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </Button>

          {/* Copy button when password present */}
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              disabled={disabled}
              className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
              title="Copy password to clipboard"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          )}

          {/* Visibility toggle */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
            className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Password feedback & strength indicator */}
      {showStrength && value && (
        <div className="flex items-center justify-between gap-2 pt-0.5 px-0.5">
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-1.5 w-4 rounded-full transition-colors ${
                    step <= strength.score ? strength.color : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
              {strength.label}
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {value.length} characters
          </span>
        </div>
      )}
    </div>
  );
}
