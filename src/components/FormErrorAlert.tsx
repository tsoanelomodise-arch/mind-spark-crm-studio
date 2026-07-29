import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, X } from "lucide-react";

interface FormErrorAlertProps {
  error: string | null;
  onDismiss?: () => void;
  title?: string;
  className?: string;
}

export function FormErrorAlert({
  error,
  onDismiss,
  title = "Error adding record",
  className = "",
}: FormErrorAlertProps) {
  if (!error) return null;

  return (
    <Alert
      variant="destructive"
      className={`relative my-3 bg-destructive/10 border-destructive/30 text-destructive dark:bg-destructive/20 animate-in fade-in-50 duration-200 ${className}`}
    >
      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
      <div className="flex-1 min-w-0 pr-6">
        {title && <AlertTitle className="font-semibold text-xs tracking-tight">{title}</AlertTitle>}
        <AlertDescription className="text-xs text-destructive/90 mt-0.5 break-words font-sans">
          {error}
        </AlertDescription>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2.5 p-1 rounded-md text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition"
          aria-label="Dismiss error notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </Alert>
  );
}
