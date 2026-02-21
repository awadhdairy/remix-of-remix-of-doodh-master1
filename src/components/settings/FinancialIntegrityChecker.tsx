import { useState } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Loader2, HeartPulse, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface MismatchEntry {
  name: string;
  expected: number;
  actual: number;
}

interface OrphanedInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  final_amount: number;
  billing_period_start: string;
  billing_period_end: string;
}

interface OrphanedLedger {
  id: string;
  reference_id: string;
  description: string;
  debit_amount: number;
  customer_id: string;
}

interface CheckResult {
  status: "pass" | "fail";
  label: string;
  detail: string;
  mismatches?: MismatchEntry[];
  orphanedInvoices?: OrphanedInvoice[];
  orphanedLedgers?: OrphanedLedger[];
  count?: number;
}

async function paginatedFetch(
  tableName: string,
  selectCols: string,
  filters?: (q: any) => any,
  pageSize = 1000
): Promise<any[]> {
  const all: any[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(tableName as any).select(selectCols).range(from, from + pageSize - 1);
    if (filters) q = filters(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function runCheckA(): Promise<CheckResult> {
  const { data: customers, error: cErr } = await supabase
    .from("customers")
    .select("id, name, credit_balance")
    .eq("is_active", true);
  if (cErr) throw cErr;
  if (!customers || customers.length === 0)
    return { status: "pass", label: "Ledger ↔ Balance Sync", detail: "No active customers to check." };

  const ledgerEntries = await paginatedFetch(
    "customer_ledger",
    "customer_id, debit_amount, credit_amount"
  );

  const ledgerTotals = new Map<string, number>();
  for (const e of ledgerEntries) {
    const prev = ledgerTotals.get(e.customer_id) ?? 0;
    ledgerTotals.set(e.customer_id, prev + Number(e.debit_amount ?? 0) - Number(e.credit_amount ?? 0));
  }

  const mismatches: MismatchEntry[] = [];
  for (const c of customers) {
    const expected = Math.round((ledgerTotals.get(c.id) ?? 0) * 100) / 100;
    const actual = Math.round(Number(c.credit_balance ?? 0) * 100) / 100;
    if (expected !== actual) {
      mismatches.push({ name: c.name, expected, actual });
    }
  }

  if (mismatches.length === 0)
    return { status: "pass", label: "Ledger ↔ Balance Sync", detail: `All ${customers.length} active customers in sync.` };

  return {
    status: "fail",
    label: "Ledger ↔ Balance Sync",
    detail: `${mismatches.length} customer(s) have mismatched balances.`,
    mismatches,
  };
}

async function runCheckB(): Promise<CheckResult> {
  const invoices = await paginatedFetch("invoices", "id, invoice_number, customer_id, final_amount, billing_period_start, billing_period_end");
  if (invoices.length === 0)
    return { status: "pass", label: "Orphaned Invoices", detail: "No invoices in the system." };

  const ledgerRefs = await paginatedFetch(
    "customer_ledger",
    "reference_id",
    (q: any) => q.eq("transaction_type", "invoice").not("reference_id", "is", null)
  );

  const ledgerRefSet = new Set(ledgerRefs.map((l: any) => l.reference_id));
  const orphaned = invoices.filter((i: any) => !ledgerRefSet.has(i.id));

  if (orphaned.length === 0)
    return { status: "pass", label: "Orphaned Invoices", detail: `All ${invoices.length} invoices have ledger entries.` };

  // Fetch customer names for orphaned invoices
  const customerIds = [...new Set(orphaned.map((i: any) => i.customer_id))];
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .in("id", customerIds);
  const customerMap = new Map((customers || []).map((c: any) => [c.id, c.name]));

  const orphanedInvoices: OrphanedInvoice[] = orphaned.map((i: any) => ({
    id: i.id,
    invoice_number: i.invoice_number,
    customer_id: i.customer_id,
    customer_name: customerMap.get(i.customer_id) || "Unknown",
    final_amount: Number(i.final_amount),
    billing_period_start: i.billing_period_start,
    billing_period_end: i.billing_period_end,
  }));

  return {
    status: "fail",
    label: "Orphaned Invoices",
    detail: `${orphaned.length} invoice(s) have no corresponding ledger debit entry.`,
    orphanedInvoices,
    count: orphaned.length,
  };
}

async function runCheckC(): Promise<CheckResult> {
  const ledgerRefs = await paginatedFetch(
    "customer_ledger",
    "id, reference_id, description, debit_amount, customer_id",
    (q: any) => q.eq("transaction_type", "invoice").not("reference_id", "is", null)
  );
  if (ledgerRefs.length === 0)
    return { status: "pass", label: "Orphaned Ledger Entries", detail: "No invoice ledger entries to check." };

  const invoices = await paginatedFetch("invoices", "id");
  const invoiceIdSet = new Set(invoices.map((i: any) => i.id));
  const orphaned = ledgerRefs.filter((l: any) => !invoiceIdSet.has(l.reference_id));

  if (orphaned.length === 0)
    return { status: "pass", label: "Orphaned Ledger Entries", detail: `All ${ledgerRefs.length} invoice ledger entries have matching invoices.` };

  return {
    status: "fail",
    label: "Orphaned Ledger Entries",
    detail: `${orphaned.length} ledger debit(s) reference invoices that no longer exist.`,
    orphanedLedgers: orphaned.map((l: any) => ({
      id: l.id,
      reference_id: l.reference_id,
      description: l.description,
      debit_amount: Number(l.debit_amount),
      customer_id: l.customer_id,
    })),
    count: orphaned.length,
  };
}

export function FinancialIntegrityChecker() {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const runAllChecks = async () => {
    setRunning(true);
    setError(null);
    setResults(null);
    try {
      const [a, b, c] = await Promise.all([runCheckA(), runCheckB(), runCheckC()]);
      setResults([a, b, c]);
    } catch (e: any) {
      setError(e.message || "Failed to run checks");
    } finally {
      setRunning(false);
    }
  };

  const fixOrphanedInvoices = async (orphanedInvoices: OrphanedInvoice[]) => {
    setFixing(true);
    let fixed = 0;
    let failed = 0;

    for (const inv of orphanedInvoices) {
      try {
        const { error: rpcError } = await supabase.rpc("insert_ledger_with_balance", {
          _customer_id: inv.customer_id,
          _transaction_date: inv.billing_period_start,
          _transaction_type: "invoice",
          _description: `Invoice ${inv.invoice_number} (${format(new Date(inv.billing_period_start), "dd MMM")} - ${format(new Date(inv.billing_period_end), "dd MMM")})`,
          _debit_amount: inv.final_amount,
          _credit_amount: 0,
          _reference_id: inv.id,
        });
        if (rpcError) throw rpcError;
        fixed++;
      } catch {
        failed++;
      }
    }

    setFixing(false);
    toast({
      title: "Orphaned Invoices Fixed",
      description: `${fixed} ledger entries created${failed > 0 ? `, ${failed} failed` : ""}. Re-running checks…`,
      variant: failed > 0 ? "destructive" : "default",
    });

    // Re-run checks to show updated state
    await runAllChecks();
  };

  const fixOrphanedLedgers = async (orphanedLedgers: OrphanedLedger[]) => {
    setFixing(true);
    let fixed = 0;
    let failed = 0;

    for (const entry of orphanedLedgers) {
      try {
        const { error: delError } = await supabase
          .from("customer_ledger")
          .delete()
          .eq("id", entry.id);
        if (delError) throw delError;
        fixed++;
      } catch {
        failed++;
      }
    }

    // Recalculate balances for affected customers
    const affectedCustomers = [...new Set(orphanedLedgers.map(l => l.customer_id))];
    for (const customerId of affectedCustomers) {
      try {
        await supabase.rpc("recalculate_ledger_balances", { _customer_id: customerId });
      } catch {
        // Non-critical — balance will be recalculated on next trigger
      }
    }

    setFixing(false);
    toast({
      title: "Orphaned Ledger Entries Cleaned",
      description: `${fixed} entries removed${failed > 0 ? `, ${failed} failed` : ""}. Re-running checks…`,
      variant: failed > 0 ? "destructive" : "default",
    });

    await runAllChecks();
  };

  const fixMismatches = async (mismatches: MismatchEntry[]) => {
    setFixing(true);
    let fixed = 0;

    // Trigger recalculation by fetching customer IDs from name
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name")
      .eq("is_active", true);

    const nameToId = new Map((customers || []).map(c => [c.name, c.id]));

    for (const m of mismatches) {
      const customerId = nameToId.get(m.name);
      if (!customerId) continue;
      try {
        // Force credit_balance to match ledger sum
        const { error } = await supabase
          .from("customers")
          .update({ credit_balance: m.expected })
          .eq("id", customerId);
        if (!error) fixed++;
      } catch {
        // skip
      }
    }

    setFixing(false);
    toast({
      title: "Balance Sync Fixed",
      description: `${fixed} customer balance(s) corrected to match ledger totals. Re-running checks…`,
    });

    await runAllChecks();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5" />
          Financial Integrity Health Check
        </CardTitle>
        <CardDescription>
          Read-only diagnostic: verifies ledger-balance sync, orphaned invoices, and orphaned ledger entries. Includes repair tools.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runAllChecks} disabled={running || fixing} className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartPulse className="h-4 w-4" />}
          {running ? "Running…" : "Run Financial Health Check"}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {results && (
          <div className="grid gap-4 md:grid-cols-3">
            {results.map((r, i) => (
              <Alert key={i} variant={r.status === "pass" ? "default" : "destructive"} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {r.status === "pass" ? (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                  <AlertTitle className="mb-0">{r.label}</AlertTitle>
                  <Badge variant={r.status === "pass" ? "outline" : "destructive"} className="ml-auto">
                    {r.status === "pass" ? "PASS" : "FAIL"}
                  </Badge>
                </div>
                <AlertDescription className="text-xs">{r.detail}</AlertDescription>

                {/* Mismatch details for Check A */}
                {r.mismatches && r.mismatches.length > 0 && (
                  <>
                    <div className="mt-1 max-h-40 overflow-y-auto text-xs space-y-1">
                      {r.mismatches.slice(0, 20).map((m, j) => (
                        <div key={j} className="flex justify-between border-b border-border pb-1">
                          <span className="font-medium truncate max-w-[120px]">{m.name}</span>
                          <span>
                            Ledger: ₹{m.expected.toLocaleString()} / Stored: ₹{m.actual.toLocaleString()}
                          </span>
                        </div>
                      ))}
                      {r.mismatches.length > 20 && (
                        <p className="text-muted-foreground">…and {r.mismatches.length - 20} more</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 gap-1"
                      disabled={fixing}
                      onClick={() => fixMismatches(r.mismatches!)}
                    >
                      {fixing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
                      Fix: Sync Balances to Ledger
                    </Button>
                  </>
                )}

                {/* Orphaned invoice details for Check B */}
                {r.orphanedInvoices && r.orphanedInvoices.length > 0 && (
                  <>
                    <div className="mt-1 max-h-40 overflow-y-auto text-xs space-y-1">
                      {r.orphanedInvoices.slice(0, 20).map((inv, j) => (
                        <div key={j} className="flex justify-between border-b border-border pb-1">
                          <span className="font-medium truncate max-w-[100px]">{inv.customer_name}</span>
                          <span>{inv.invoice_number} — ₹{inv.final_amount.toLocaleString()}</span>
                        </div>
                      ))}
                      {r.orphanedInvoices.length > 20 && (
                        <p className="text-muted-foreground">…and {r.orphanedInvoices.length - 20} more</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 gap-1"
                      disabled={fixing}
                      onClick={() => fixOrphanedInvoices(r.orphanedInvoices!)}
                    >
                      {fixing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
                      Fix: Create Missing Ledger Entries
                    </Button>
                  </>
                )}

                {/* Orphaned ledger details for Check C */}
                {r.orphanedLedgers && r.orphanedLedgers.length > 0 && (
                  <>
                    <div className="mt-1 max-h-40 overflow-y-auto text-xs space-y-1">
                      {r.orphanedLedgers.slice(0, 20).map((entry, j) => (
                        <div key={j} className="flex justify-between border-b border-border pb-1">
                          <span className="font-medium truncate max-w-[140px]">{entry.description}</span>
                          <span>₹{entry.debit_amount.toLocaleString()}</span>
                        </div>
                      ))}
                      {r.orphanedLedgers.length > 20 && (
                        <p className="text-muted-foreground">…and {r.orphanedLedgers.length - 20} more</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 gap-1"
                      disabled={fixing}
                      onClick={() => fixOrphanedLedgers(r.orphanedLedgers!)}
                    >
                      {fixing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
                      Fix: Remove Orphaned Entries
                    </Button>
                  </>
                )}
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
