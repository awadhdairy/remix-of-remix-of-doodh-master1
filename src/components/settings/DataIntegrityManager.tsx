import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Shield, AlertTriangle, CheckCircle, RefreshCw, Trash2, Users, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invokeExternalFunctionWithSession } from "@/lib/external-supabase";

interface OrphanedDataStats {
  orphanedProfiles: number;
  orphanedRoles: number;
  orphanedAuthUsers: number;
  orphanedSessions: number;
}

interface CleanupResult {
  success: boolean;
  message?: string;
  orphanedProfiles?: number;
  orphanedRoles?: number;
  orphanedAuthUsers?: number;
  orphanedSessions?: number;
  details?: Array<{ type: string; id: string; success: boolean; error?: string }>;
  error?: string;
}

export function DataIntegrityManager() {
  const [loading, setLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const { toast } = useToast();

  const runComprehensiveCleanup = async () => {
    setLoading(true);
    setCleanupResult(null);

    try {
      const response = await invokeExternalFunctionWithSession<CleanupResult>("delete-user", {
        action: "cleanup-all-orphan-types"
      });

      if (response.error) {
        throw new Error(response.error.message || "Cleanup failed");
      }

      const result = response.data;
      setCleanupResult(result || null);

      if (result?.success) {
        const totalCleaned = (result.orphanedProfiles || 0) + 
                            (result.orphanedRoles || 0) + 
                            (result.orphanedAuthUsers || 0) + 
                            (result.orphanedSessions || 0);
        
        if (totalCleaned > 0) {
          toast({
            title: "Cleanup Complete",
            description: `Successfully cleaned up ${totalCleaned} orphaned records`,
          });
        } else {
          toast({
            title: "No Issues Found",
            description: "Your database is clean - no orphaned data detected",
          });
        }
      } else {
        throw new Error(result?.error || "Cleanup failed");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Cleanup Failed",
        description: message,
        variant: "destructive",
      });
      setCleanupResult({ success: false, error: message });
    } finally {
      setLoading(false);
    }
  };

  const hasOrphanedData = cleanupResult && cleanupResult.success && (
    (cleanupResult.orphanedProfiles || 0) > 0 ||
    (cleanupResult.orphanedRoles || 0) > 0 ||
    (cleanupResult.orphanedAuthUsers || 0) > 0 ||
    (cleanupResult.orphanedSessions || 0) > 0
  );

  const isClean = cleanupResult && cleanupResult.success && !hasOrphanedData;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Data Integrity Manager
        </CardTitle>
        <CardDescription>
          Detect and clean up orphaned data (profiles without auth users, roles without profiles, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Explanation */}
        <Alert>
          <Database className="h-4 w-4" />
          <AlertTitle>What is orphaned data?</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Orphaned data occurs when records in one table lose their connection to related records in another table:
            </p>
            <ul className="list-disc pl-4 text-sm space-y-1">
              <li><strong>Orphaned Profiles:</strong> Profile records without matching authentication users</li>
              <li><strong>Orphaned Roles:</strong> Role assignments for users that no longer exist</li>
              <li><strong>Orphaned Auth Users:</strong> Authentication records without matching profiles</li>
              <li><strong>Orphaned Sessions:</strong> Login sessions for non-existent users</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={runComprehensiveCleanup} 
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Scan & Clean Orphaned Data
          </Button>
        </div>

        {/* Results */}
        {cleanupResult && (
          <div className="space-y-4">
            {cleanupResult.success ? (
              <>
                {isClean ? (
                  <Alert className="border-success bg-success/10">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <AlertTitle className="text-success">Database is Clean</AlertTitle>
                    <AlertDescription>
                      No orphaned data was detected. Your database integrity is maintained.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-warning bg-warning/10">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <AlertTitle className="text-warning">Cleanup Completed</AlertTitle>
                    <AlertDescription>
                      Orphaned data has been cleaned up successfully.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Profiles</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-2xl font-bold">{cleanupResult.orphanedProfiles || 0}</span>
                      <Badge variant={cleanupResult.orphanedProfiles ? "destructive" : "secondary"}>
                        {cleanupResult.orphanedProfiles ? "cleaned" : "ok"}
                      </Badge>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Roles</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-2xl font-bold">{cleanupResult.orphanedRoles || 0}</span>
                      <Badge variant={cleanupResult.orphanedRoles ? "destructive" : "secondary"}>
                        {cleanupResult.orphanedRoles ? "cleaned" : "ok"}
                      </Badge>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Auth Users</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-2xl font-bold">{cleanupResult.orphanedAuthUsers || 0}</span>
                      <Badge variant={cleanupResult.orphanedAuthUsers ? "destructive" : "secondary"}>
                        {cleanupResult.orphanedAuthUsers ? "cleaned" : "ok"}
                      </Badge>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Sessions</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-2xl font-bold">{cleanupResult.orphanedSessions || 0}</span>
                      <Badge variant={cleanupResult.orphanedSessions ? "destructive" : "secondary"}>
                        {cleanupResult.orphanedSessions ? "cleaned" : "ok"}
                      </Badge>
                    </div>
                  </Card>
                </div>

                {/* Details */}
                {cleanupResult.details && cleanupResult.details.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Cleanup Details</h4>
                    <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
                      {cleanupResult.details.map((item, idx) => (
                        <div 
                          key={idx} 
                          className={`flex items-center gap-2 px-2 py-1 rounded ${
                            item.success ? 'bg-success/10' : 'bg-destructive/10'
                          }`}
                        >
                          {item.success ? (
                            <CheckCircle className="h-3 w-3 text-success" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                          )}
                          <span className="capitalize">{item.type}:</span>
                          <code className="text-xs bg-muted px-1 rounded">{item.id.slice(0, 8)}...</code>
                          {item.error && (
                            <span className="text-destructive text-xs">({item.error})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Cleanup Failed</AlertTitle>
                <AlertDescription>
                  {cleanupResult.error || "An unknown error occurred during cleanup."}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Info */}
        <p className="text-xs text-muted-foreground">
          Running this cleanup is safe and will only remove records that are no longer connected to valid users.
          All actions are logged in the activity log.
        </p>
      </CardContent>
    </Card>
  );
}
