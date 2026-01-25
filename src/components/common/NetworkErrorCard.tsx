import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface NetworkErrorCardProps {
  onRetry?: () => void;
  message?: string;
  isRetrying?: boolean;
}

export function NetworkErrorCard({ 
  onRetry, 
  message = "Unable to connect to the server. Please check your connection and try again.",
  isRetrying = false 
}: NetworkErrorCardProps) {
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <WifiOff className="h-6 w-6 text-muted-foreground" />
        </div>
        <CardTitle>Connection Error</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      {onRetry && (
        <CardContent className="flex justify-center">
          <Button 
            onClick={onRetry} 
            disabled={isRetrying}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
