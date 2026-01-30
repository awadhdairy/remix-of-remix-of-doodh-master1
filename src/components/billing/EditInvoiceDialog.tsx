import { useState, useEffect, useCallback } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Loader2, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Package, 
  Sparkles,
  Edit3,
  AlertTriangle
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  base_price: number;
  unit: string;
  tax_percentage: number;
}

interface LineItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  rate: number;
  tax_percentage: number;
  amount: number;
  is_addon: boolean;
  delivery_count?: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  billing_period_start: string;
  billing_period_end: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
  paid_amount: number;
  payment_status: string;
  notes?: string | null;
  customer?: { id: string; name: string };
}

interface EditInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  invoice: Invoice | null;
  products: Product[];
}

export function EditInvoiceDialog({
  open,
  onOpenChange,
  onComplete,
  invoice,
  products,
}: EditInvoiceDialogProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Load invoice data when dialog opens
  useEffect(() => {
    if (open && invoice) {
      loadInvoiceData();
    }
  }, [open, invoice]);

  const loadInvoiceData = useCallback(async () => {
    if (!invoice) return;

    setLoading(true);
    setDiscountAmount(Number(invoice.discount_amount) || 0);

    try {
      // Fetch deliveries with items for this invoice period
      const { data: deliveries, error: deliveryError } = await supabase
        .from("deliveries")
        .select(`
          id,
          delivery_date,
          status,
          delivery_items (
            product_id,
            quantity,
            unit_price,
            total_amount
          )
        `)
        .eq("customer_id", invoice.customer_id)
        .eq("status", "delivered")
        .gte("delivery_date", invoice.billing_period_start)
        .lte("delivery_date", invoice.billing_period_end);

      if (deliveryError) throw deliveryError;

      // Fetch customer subscriptions to identify add-ons
      const { data: subscriptions } = await supabase
        .from("customer_products")
        .select("product_id")
        .eq("customer_id", invoice.customer_id)
        .eq("is_active", true);

      const subscriptionProductIds = new Set(subscriptions?.map(s => s.product_id) || []);

      // Aggregate items by product
      const itemsMap = new Map<string, {
        quantity: number;
        total_amount: number;
        unit_price: number;
        is_addon: boolean;
        delivery_count: number;
      }>();

      deliveries?.forEach(delivery => {
        (delivery.delivery_items || []).forEach((item: any) => {
          const existing = itemsMap.get(item.product_id);
          const isAddon = !subscriptionProductIds.has(item.product_id);
          
          if (existing) {
            existing.quantity += item.quantity;
            existing.total_amount += item.total_amount;
            existing.delivery_count += 1;
          } else {
            itemsMap.set(item.product_id, {
              quantity: item.quantity,
              total_amount: item.total_amount,
              unit_price: item.unit_price,
              is_addon: isAddon,
              delivery_count: 1,
            });
          }
        });
      });

      // Convert to line items
      const items: LineItem[] = [];
      
      itemsMap.forEach((data, productId) => {
        const product = products.find(p => p.id === productId);
        if (product) {
          items.push({
            id: crypto.randomUUID(),
            product_id: productId,
            product_name: product.name,
            quantity: data.quantity,
            unit: product.unit,
            rate: data.unit_price || product.base_price,
            tax_percentage: product.tax_percentage || 0,
            amount: data.total_amount,
            is_addon: data.is_addon,
            delivery_count: data.delivery_count,
          });
        }
      });

      // If no delivery items found, try to parse from notes
      if (items.length === 0 && invoice.notes) {
        const noteParts = invoice.notes.split("|").flatMap(part => part.split(";"));
        noteParts.forEach(part => {
          const match = part.trim().match(/(?:\[ADD-ON\]\s*)?(.+?):\s*([\d.]+)\s*(\w+)\s*@\s*₹?([\d.]+)/);
          if (match) {
            const [, productName, qty, unit, rate] = match;
            const product = products.find(p => p.name.toLowerCase() === productName.trim().toLowerCase());
            const isAddon = part.includes("[ADD-ON]");
            const quantity = parseFloat(qty);
            const unitPrice = parseFloat(rate);
            
            items.push({
              id: crypto.randomUUID(),
              product_id: product?.id || "",
              product_name: productName.trim(),
              quantity,
              unit: unit || product?.unit || "unit",
              rate: unitPrice,
              tax_percentage: product?.tax_percentage || 0,
              amount: quantity * unitPrice,
              is_addon: isAddon,
            });
          }
        });
      }

      // Sort: subscriptions first, then add-ons
      items.sort((a, b) => {
        if (a.is_addon !== b.is_addon) return a.is_addon ? 1 : -1;
        return a.product_name.localeCompare(b.product_name);
      });

      setLineItems(items);
    } catch (error: any) {
      console.error("Error loading invoice data:", error);
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [invoice, products, toast]);

  const addLineItem = () => {
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      product_id: "",
      product_name: "",
      quantity: 0,
      unit: "-",
      rate: 0,
      tax_percentage: 0,
      amount: 0,
      is_addon: true,
    };
    setLineItems([...lineItems, newItem]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      if (field === "product_id") {
        const product = products.find(p => p.id === value);
        if (product) {
          updated.product_name = product.name;
          updated.rate = product.base_price;
          updated.unit = product.unit;
          updated.tax_percentage = product.tax_percentage || 0;
        }
      }
      
      const baseAmount = updated.quantity * updated.rate;
      const taxAmount = (baseAmount * updated.tax_percentage) / 100;
      updated.amount = baseAmount + taxAmount;
      
      return updated;
    }));
  };

  // Calculate totals
  const subscriptionItems = lineItems.filter(i => !i.is_addon);
  const addonItems = lineItems.filter(i => i.is_addon);
  
  const subscriptionTotal = subscriptionItems.reduce((sum, item) => sum + item.amount, 0);
  const addonTotal = addonItems.reduce((sum, item) => sum + item.amount, 0);
  const subtotal = subscriptionTotal + addonTotal;
  
  const totalTax = lineItems.reduce((sum, item) => {
    const baseAmount = item.quantity * item.rate;
    return sum + (baseAmount * item.tax_percentage) / 100;
  }, 0);
  
  const grandTotal = subtotal - discountAmount;

  const handleUpdateInvoice = async () => {
    if (!invoice) return;

    if (lineItems.length === 0 || lineItems.every(item => item.amount === 0)) {
      toast({
        title: "Validation Error",
        description: "Please add at least one line item with quantity and rate",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    
    // Format line items for notes
    const subscriptionDetail = subscriptionItems
      .filter(item => item.product_id && item.quantity > 0)
      .map(item => `${item.product_name}: ${item.quantity} ${item.unit} @ ₹${item.rate}/${item.unit}`)
      .join("; ");
    
    const addonDetail = addonItems
      .filter(item => item.product_id && item.quantity > 0)
      .map(item => `[ADD-ON] ${item.product_name}: ${item.quantity} ${item.unit} @ ₹${item.rate}/${item.unit}`)
      .join("; ");
    
    const allDetails = [subscriptionDetail, addonDetail].filter(Boolean).join(" | ");

    const { error } = await supabase
      .from("invoices")
      .update({
        total_amount: subtotal,
        tax_amount: totalTax,
        discount_amount: discountAmount,
        final_amount: grandTotal,
        notes: allDetails || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (error) {
      toast({
        title: "Error updating invoice",
        description: error.message,
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    // Update ledger entry if exists
    const amountDiff = grandTotal - Number(invoice.final_amount);
    if (Math.abs(amountDiff) > 0.01) {
      // Find and update the ledger entry
      const { data: ledgerEntry } = await supabase
        .from("customer_ledger")
        .select("id, debit_amount")
        .eq("customer_id", invoice.customer_id)
        .eq("transaction_type", "invoice")
        .ilike("description", `%${invoice.invoice_number}%`)
        .single();

      if (ledgerEntry) {
        await supabase
          .from("customer_ledger")
          .update({ debit_amount: grandTotal })
          .eq("id", ledgerEntry.id);
      }
    }

    setSaving(false);
    toast({
      title: "Invoice updated",
      description: `Invoice ${invoice.invoice_number} has been updated successfully`,
    });
    
    onComplete();
    onOpenChange(false);
  };

  const canEdit = invoice && invoice.payment_status !== "paid";

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Edit Invoice
            {invoice && (
              <Badge variant="outline" className="ml-2 font-mono">
                {invoice.invoice_number}
              </Badge>
            )}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {invoice?.customer?.name} • {invoice && format(new Date(invoice.billing_period_start), "dd MMM")} - {invoice && format(new Date(invoice.billing_period_end), "dd MMM yyyy")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {!canEdit && (
          <div className="rounded-lg bg-warning/10 border border-warning/30 p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <p className="text-sm">This invoice is already paid and cannot be edited.</p>
          </div>
        )}

        <ScrollArea className="flex-1 pr-4 max-h-[60vh]">
          <div className="grid gap-4 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading invoice data...</span>
              </div>
            ) : (
              <>
                {/* Refresh Button */}
                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={loadInvoiceData}
                    disabled={loading || !canEdit}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reload from Deliveries
                  </Button>
                </div>

                {/* Subscription Items Section */}
                {subscriptionItems.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-semibold">Subscription Items</Label>
                      <Badge variant="secondary" className="text-xs">
                        ₹{subscriptionTotal.toLocaleString("en-IN")}
                      </Badge>
                    </div>
                    
                    {renderItemsTable(subscriptionItems, false)}
                  </div>
                )}

                {/* Add-on Items Section */}
                {addonItems.length > 0 && (
                  <>
                    {subscriptionItems.length > 0 && <Separator />}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-warning" />
                        <Label className="text-sm font-semibold">Add-on / Extra Orders</Label>
                        <Badge variant="outline" className="text-xs text-warning border-warning">
                          ₹{addonTotal.toLocaleString("en-IN")}
                        </Badge>
                      </div>
                      
                      {renderItemsTable(addonItems, true)}
                    </div>
                  </>
                )}

                {/* Empty State */}
                {lineItems.length === 0 && (
                  <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground">
                    <p>No items found</p>
                    <p className="text-sm">Add items manually below</p>
                  </div>
                )}

                {/* Add Manual Item */}
                {canEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLineItem}
                    className="gap-1 w-fit"
                  >
                    <Plus className="h-4 w-4" /> Add Item
                  </Button>
                )}

                {/* Discount */}
                <div className="space-y-2">
                  <Label>Discount (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount || ""}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="max-w-[200px]"
                    disabled={!canEdit}
                  />
                </div>

                {/* Summary */}
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  {subscriptionItems.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Package className="h-3 w-3" /> Subscriptions:
                      </span>
                      <span>₹{subscriptionTotal.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {addonItems.length > 0 && (
                    <div className="flex justify-between text-sm text-warning">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3 w-3" /> Add-ons:
                      </span>
                      <span>₹{addonTotal.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>₹{subtotal.toLocaleString("en-IN")}</span>
                  </div>
                  {totalTax > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Tax (included):</span>
                      <span>₹{totalTax.toFixed(2)}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Discount:</span>
                      <span>-₹{discountAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Grand Total:</span>
                    <span className="text-primary">₹{grandTotal.toLocaleString("en-IN")}</span>
                  </div>
                  {invoice && Math.abs(grandTotal - Number(invoice.final_amount)) > 0.01 && (
                    <div className="flex justify-between text-xs text-muted-foreground pt-1">
                      <span>Previous Amount:</span>
                      <span className="line-through">₹{Number(invoice.final_amount).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateInvoice} 
            disabled={saving || !canEdit || lineItems.length === 0}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Invoice
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );

  function renderItemsTable(items: LineItem[], isAddon: boolean) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
          <div className="col-span-4">Product</div>
          <div className="col-span-2 text-center">Qty</div>
          <div className="col-span-2 text-right">Rate (₹)</div>
          <div className="col-span-3 text-right">Amount</div>
          <div className="col-span-1"></div>
        </div>

        {items.map((item) => (
          <div key={item.id} className={`grid grid-cols-12 gap-2 items-center rounded-lg p-1 ${isAddon ? 'bg-warning/5' : ''}`}>
            <div className="col-span-4">
              {item.product_id ? (
                <span className="text-sm font-medium">{item.product_name}</span>
              ) : (
                <Select
                  value={item.product_id}
                  onValueChange={(v) => updateLineItem(item.id, "product_id", v)}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="col-span-2">
              <Input
                type="number"
                min="0"
                step="0.5"
                className="h-8 text-center text-sm"
                value={item.quantity || ""}
                onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                disabled={!canEdit}
              />
            </div>
            <div className="col-span-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                className="h-8 text-right text-sm"
                value={item.rate || ""}
                onChange={(e) => updateLineItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                disabled={!canEdit}
              />
            </div>
            <div className="col-span-3 text-right">
              <span className="font-medium text-sm">₹{item.amount.toLocaleString("en-IN")}</span>
              {item.delivery_count && item.delivery_count > 1 && (
                <span className="text-xs text-muted-foreground block">
                  ({item.delivery_count} deliveries)
                </span>
              )}
            </div>
            <div className="col-span-1 flex justify-center">
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => removeLineItem(item.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }
}
