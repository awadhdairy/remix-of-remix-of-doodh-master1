import { useState, useEffect } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Loader2, ArrowUpCircle, ArrowDownCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { handleError } from "@/lib/errors";

interface Bottle {
  id: string;
  bottle_type: string;
  size: string;
  total_quantity: number;
  available_quantity: number;
  deposit_amount: number;
}

interface Customer {
  id: string;
  name: string;
}

interface BottleTransaction {
  id: string;
  bottle_id: string;
  customer_id: string | null;
  transaction_type: string;
  quantity: number;
  transaction_date: string;
  notes: string | null;
  created_at: string;
}

export default function BottlesPage() {
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [transactions, setTransactions] = useState<BottleTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bottleForm, setBottleForm] = useState({
    bottle_type: "glass" as "glass" | "plastic",
    size: "1L" as "500ml" | "1L" | "2L",
    total_quantity: "",
    deposit_amount: "",
  });
  const [transactionForm, setTransactionForm] = useState({
    bottle_id: "",
    customer_id: "",
    transaction_type: "issued",
    quantity: "",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const [bottlesRes, transactionsRes, customersRes] = await Promise.all([
      supabase.from("bottles").select("*").order("bottle_type").order("size"),
      supabase.from("bottle_transactions").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("customers").select("id, name").eq("is_active", true).order("name"),
    ]);

    if (bottlesRes.data) setBottles(bottlesRes.data);
    if (transactionsRes.data) setTransactions(transactionsRes.data);
    if (customersRes.data) setCustomers(customersRes.data);

    setLoading(false);
  };

  const handleAddBottle = async () => {
    if (!bottleForm.total_quantity) {
      toast({ title: "Enter quantity", variant: "destructive" });
      return;
    }

    setSaving(true);
    const qty = parseInt(bottleForm.total_quantity);
    const { error } = await supabase.from("bottles").upsert({
      bottle_type: bottleForm.bottle_type,
      size: bottleForm.size,
      total_quantity: qty,
      available_quantity: qty,
      deposit_amount: parseFloat(bottleForm.deposit_amount) || 0,
    }, { onConflict: "bottle_type,size" });

    setSaving(false);

    if (error) {
      toast({ title: "Error adding bottles", description: handleError(error, "bottles"), variant: "destructive" });
    } else {
      toast({ title: "Bottles added", description: `${qty} ${bottleForm.size} ${bottleForm.bottle_type} bottles added` });
      setDialogOpen(false);
      setBottleForm({ bottle_type: "glass", size: "1L", total_quantity: "", deposit_amount: "" });
      fetchData();
    }
  };

  const handleTransaction = async () => {
    if (!transactionForm.bottle_id || !transactionForm.quantity) {
      toast({ title: "Fill required fields", variant: "destructive" });
      return;
    }

    setSaving(true);
    const qty = parseInt(transactionForm.quantity);
    const bottle = bottles.find(b => b.id === transactionForm.bottle_id);
    
    if (!bottle) {
      setSaving(false);
      return;
    }

    // Update bottle quantity
    let newAvailable = bottle.available_quantity;
    if (transactionForm.transaction_type === "issued") {
      newAvailable -= qty;
    } else if (transactionForm.transaction_type === "returned") {
      newAvailable += qty;
    } else if (transactionForm.transaction_type === "damaged" || transactionForm.transaction_type === "lost") {
      newAvailable -= qty;
    }

    const { error: transError } = await supabase.from("bottle_transactions").insert({
      bottle_id: transactionForm.bottle_id,
      customer_id: transactionForm.customer_id || null,
      transaction_type: transactionForm.transaction_type,
      quantity: qty,
      transaction_date: format(new Date(), "yyyy-MM-dd"),
      notes: transactionForm.notes || null,
    });

    const { error: updateError } = await supabase
      .from("bottles")
      .update({ available_quantity: Math.max(0, newAvailable) })
      .eq("id", transactionForm.bottle_id);

    setSaving(false);

    if (transError || updateError) {
      toast({ title: "Error recording transaction", description: handleError(transError || updateError, "bottle-transaction"), variant: "destructive" });
    } else {
      toast({ title: "Transaction recorded" });
      setTransactionDialogOpen(false);
      setTransactionForm({ bottle_id: "", customer_id: "", transaction_type: "issued", quantity: "", notes: "" });
      fetchData();
    }
  };

  const totalBottles = bottles.reduce((sum, b) => sum + b.total_quantity, 0);
  const availableBottles = bottles.reduce((sum, b) => sum + b.available_quantity, 0);
  const issuedBottles = totalBottles - availableBottles;

  const transactionColumns = [
    {
      key: "transaction_date",
      header: "Date",
      render: (item: BottleTransaction) => format(new Date(item.transaction_date), "dd MMM yyyy"),
    },
    {
      key: "bottle",
      header: "Bottle",
      render: (item: BottleTransaction) => {
        const bottle = bottles.find(b => b.id === item.bottle_id);
        return bottle ? `${bottle.size} ${bottle.bottle_type}` : "-";
      },
    },
    {
      key: "transaction_type",
      header: "Type",
      render: (item: BottleTransaction) => (
        <Badge 
          variant="outline" 
          className={cn(
            "capitalize",
            item.transaction_type === "issued" && "bg-warning/10 text-warning border-warning/20",
            item.transaction_type === "returned" && "bg-success/10 text-success border-success/20",
            (item.transaction_type === "damaged" || item.transaction_type === "lost") && "bg-destructive/10 text-destructive border-destructive/20"
          )}
        >
          {item.transaction_type}
        </Badge>
      ),
    },
    {
      key: "quantity",
      header: "Qty",
      render: (item: BottleTransaction) => (
        <span className="font-semibold">{item.quantity}</span>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      render: (item: BottleTransaction) => item.notes || "-",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bottle Management"
        description="Track bottle inventory and circulation"
        icon={Package}
        action={{
          label: "Add Bottles",
          onClick: () => setDialogOpen(true),
        }}
      >
        <Button variant="outline" onClick={() => setTransactionDialogOpen(true)}>
          Record Transaction
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalBottles}</div>
            <p className="text-sm text-muted-foreground">Total Bottles</p>
          </CardContent>
        </Card>
        <Card className="border-success/30">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">{availableBottles}</div>
            <p className="text-sm text-muted-foreground">Available</p>
          </CardContent>
        </Card>
        <Card className="border-warning/30">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">{issuedBottles}</div>
            <p className="text-sm text-muted-foreground">With Customers</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">
              {transactions.filter(t => t.transaction_type === "damaged" || t.transaction_type === "lost").reduce((sum, t) => sum + t.quantity, 0)}
            </div>
            <p className="text-sm text-muted-foreground">Lost/Damaged</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bottles.map((bottle) => (
              <Card key={bottle.id} className="animate-scale-in">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <span className="capitalize">{bottle.size} {bottle.bottle_type}</span>
                    {bottle.available_quantity < 10 && (
                      <AlertTriangle className="h-5 w-5 text-warning" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-medium">{bottle.total_quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Available:</span>
                      <span className="font-medium text-success">{bottle.available_quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Issued:</span>
                      <span className="font-medium text-warning">{bottle.total_quantity - bottle.available_quantity}</span>
                    </div>
                    {bottle.deposit_amount > 0 && (
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Deposit:</span>
                        <span className="font-medium">₹{bottle.deposit_amount}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {bottles.length === 0 && !loading && (
              <Card className="col-span-full flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No bottles in inventory</p>
                <p className="text-muted-foreground mb-4">Add bottles to start tracking</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Add Bottles
                </Button>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <DataTable
            data={transactions}
            columns={transactionColumns}
            loading={loading}
            searchPlaceholder="Search transactions..."
            emptyMessage="No transactions recorded yet"
          />
        </TabsContent>
      </Tabs>

      {/* Add Bottles Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Bottles to Inventory</DialogTitle>
            <DialogDescription>Add new bottles or update existing stock</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={bottleForm.bottle_type} onValueChange={(v: "glass" | "plastic") => setBottleForm({ ...bottleForm, bottle_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="glass">Glass</SelectItem>
                    <SelectItem value="plastic">Plastic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Size</Label>
                <Select value={bottleForm.size} onValueChange={(v: "500ml" | "1L" | "2L") => setBottleForm({ ...bottleForm, size: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="500ml">500ml</SelectItem>
                    <SelectItem value="1L">1 Liter</SelectItem>
                    <SelectItem value="2L">2 Liter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input type="number" value={bottleForm.total_quantity} onChange={(e) => setBottleForm({ ...bottleForm, total_quantity: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Deposit (₹)</Label>
                <Input type="number" value={bottleForm.deposit_amount} onChange={(e) => setBottleForm({ ...bottleForm, deposit_amount: e.target.value })} placeholder="0" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddBottle} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Bottles
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Dialog */}
      <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Bottle Transaction</DialogTitle>
            <DialogDescription>Issue, return, or record damage</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Bottle Type *</Label>
              <Select value={transactionForm.bottle_id} onValueChange={(v) => setTransactionForm({ ...transactionForm, bottle_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select bottle" /></SelectTrigger>
                <SelectContent>
                  {bottles.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.size} {b.bottle_type} (Available: {b.available_quantity})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Transaction Type</Label>
              <Select value={transactionForm.transaction_type} onValueChange={(v) => setTransactionForm({ ...transactionForm, transaction_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="issued">Issued to Customer</SelectItem>
                  <SelectItem value="returned">Returned by Customer</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={transactionForm.customer_id} onValueChange={(v) => setTransactionForm({ ...transactionForm, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select customer (optional)" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input type="number" value={transactionForm.quantity} onChange={(e) => setTransactionForm({ ...transactionForm, quantity: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={transactionForm.notes} onChange={(e) => setTransactionForm({ ...transactionForm, notes: e.target.value })} placeholder="Optional notes" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTransactionDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleTransaction} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Record
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
