/**
 * IdleTimeoutWarning.tsx — Modal that appears before auto-logout.
 * Shows countdown and lets user dismiss to stay signed in.
 */

import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  secondsRemaining: number;
  onDismiss: () => void;
  onLogout: () => void;
}

export function IdleTimeoutWarning({ open, secondsRemaining, onDismiss, onLogout }: Props) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeDisplay = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, "0")}`
    : `${seconds}s`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDismiss(); }}>
      <DialogContent className="max-w-sm bg-card border-destructive/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Session Expiring
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            You've been inactive and your session will expire for security.
          </p>
          <div className="flex items-center justify-center gap-2 py-4">
            <Clock className="w-5 h-5 text-destructive" />
            <span className="text-3xl font-extrabold font-mono text-destructive tabular-nums">
              {timeDisplay}
            </span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onLogout} className="flex-1 text-xs">
              Sign Out Now
            </Button>
            <Button onClick={onDismiss} className="flex-1 text-xs">
              Stay Signed In
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
