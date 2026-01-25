import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserCheck, UserX, Clock, Loader2, Phone } from "lucide-react";

interface PendingAccount {
  id: string;
  phone: string;
  created_at: string;
  customer_id: string;
  approval_status: string;
  customer: {
    id: string;
    name: string;
    is_active: boolean;
  };
}

export function CustomerAccountApprovals() {
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingAccounts();
  }, []);

  const fetchPendingAccounts = async () => {
    setLoading(true);
    // Use customer_accounts_safe view to exclude pin_hash column
    const { data, error } = await supabase
      .from("customer_accounts_safe")
      .select(`
        id,
        phone,
        created_at,
        customer_id,
        approval_status,
        customer:customers(id, name, is_active)
      `)
      .eq("approval_status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error fetching pending accounts",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Transform data to handle the customer object properly
      const transformedData = (data || []).map(item => ({
        ...item,
        customer: Array.isArray(item.customer) ? item.customer[0] : item.customer
      }));
      setPendingAccounts(transformedData as PendingAccount[]);
    }
    setLoading(false);
  };

  const handleApprove = async (account: PendingAccount) => {
    setProcessingId(account.id);
    
    // Update customer_accounts to approved
    const { error: accountError } = await supabase
      .from("customer_accounts")
      .update({
        is_approved: true,
        approval_status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    if (accountError) {
      toast({
        title: "Error approving account",
        description: accountError.message,
        variant: "destructive",
      });
      setProcessingId(null);
      return;
    }

    // If the customer was created during registration (Pending Registration), activate them
    if (account.customer?.name === "Pending Registration") {
      await supabase
        .from("customers")
        .update({ is_active: true })
        .eq("id", account.customer_id);
    }

    toast({
      title: "Account approved",
      description: `Customer account for ${account.phone} has been approved`,
    });
    
    setProcessingId(null);
    fetchPendingAccounts();
  };

  const handleReject = async (account: PendingAccount) => {
    setProcessingId(account.id);
    
    const { error } = await supabase
      .from("customer_accounts")
      .update({
        is_approved: false,
        approval_status: "rejected",
      })
      .eq("id", account.id);

    if (error) {
      toast({
        title: "Error rejecting account",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account rejected",
        description: `Customer account for ${account.phone} has been rejected`,
      });
      fetchPendingAccounts();
    }
    
    setProcessingId(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (pendingAccounts.length === 0) {
    return null;
  }

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-warning" />
          Pending Customer Account Approvals
          <Badge variant="secondary" className="ml-2">
            {pendingAccounts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pendingAccounts.map((account) => (
            <div
              key={account.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-background border"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{account.phone}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {account.customer?.name === "Pending Registration" 
                    ? "New Customer Registration" 
                    : `Existing Customer: ${account.customer?.name}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  Requested: {new Date(account.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  disabled={processingId === account.id}
                  onClick={() => handleReject(account)}
                >
                  <UserX className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  disabled={processingId === account.id}
                  onClick={() => handleApprove(account)}
                >
                  {processingId === account.id ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <UserCheck className="h-4 w-4 mr-1" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
