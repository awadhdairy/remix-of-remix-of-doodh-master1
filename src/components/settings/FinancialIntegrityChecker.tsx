import { useState } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Loader2, HeartPulse } from "lucide-react";

interface MismatchEntry {
  name: string;
  expected: number;
  actual: number;
}

interface CheckResult {
  status: "pass" | "fail";
  label: string;
  detail: string;
  mismatches?: MismatchEntry[];
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
  const invoices = await paginatedFetch("invoices", "id");
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

  return {
    status: "fail",
    label: "Orphaned Invoices",
    detail: `${orphaned.length} invoice(s) have no corresponding ledger debit entry.`,
    count: orphaned.length,
  };
}

async function runCheckC(): Promise<CheckResult> {
  const ledgerRefs = await paginatedFetch(
    "customer_ledger",
    "reference_id",
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
    count: orphaned.length,
  };
}

export function FinancialIntegrityChecker() {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5" />
          Financial Integrity Health Check
        </CardTitle>
        <CardDescription>
          Read-only diagnostic: verifies ledger-balance sync, orphaned invoices, and orphaned ledger entries.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runAllChecks} disabled={running} className="gap-2">
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
                {r.mismatches && r.mismatches.length > 0 && (
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
                )}
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
