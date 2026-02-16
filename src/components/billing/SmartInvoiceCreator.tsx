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
import { format, startOfMonth, endOfMonth } from "date-fns";
import { 
  Loader2, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Package, 
  Sparkles,
  Calculator,
  AlertCircle
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
}

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
  is_addon: boolean; // True if this is an add-on (not part of regular subscription)
  delivery_count?: number; // Number of deliveries for this item
}

interface SmartInvoiceCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  customers: Customer[];
  products: Product[];
}

export function SmartInvoiceCreator({
  open,
  onOpenChange,
  onComplete,
  customers,
  products,
}: SmartInvoiceCreatorProps) {
  const [customerId, setCustomerId] = useState("");
  const [periodStart, setPeriodStart] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [periodEnd, setPeriodEnd] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);
  const [deliveryCount, setDeliveryCount] = useState(0);
  const { toast } = useToast();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setCustomerId("");
    setPeriodStart(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    setPeriodEnd(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    setLineItems([]);
    setDiscountAmount(0);
    setDataFetched(false);
    setDeliveryCount(0);
  };

  // Fetch delivered products when customer and period are selected
  const fetchDeliveryData = useCallback(async () => {
    if (!customerId || !periodStart || !periodEnd) {
      toast({
        title: "Missing information",
        description: "Please select a customer and billing period first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setDataFetched(false);

    try {
      // Fetch deliveries with items
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
        .eq("customer_id", customerId)
        .eq("status", "delivered")
        .gte("delivery_date", periodStart)
        .lte("delivery_date", periodEnd)
        .limit(10000);

      if (deliveryError) throw deliveryError;

      // Fetch customer subscriptions to identify add-ons
      const { data: subscriptions } = await supabase
        .from("customer_products")
        .select("product_id, quantity, custom_price")
        .eq("customer_id", customerId)
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

      let totalDeliveries = deliveries?.length || 0;
      setDeliveryCount(totalDeliveries);

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
            amount: data.quantity * (data.unit_price || product.base_price),
            is_addon: data.is_addon,
            delivery_count: data.delivery_count,
          });
        }
      });

      // Sort: subscriptions first, then add-ons
      items.sort((a, b) => {
        if (a.is_addon !== b.is_addon) return a.is_addon ? 1 : -1;
        return a.product_name.localeCompare(b.product_name);
      });

      setLineItems(items);
      setDataFetched(true);

      if (items.length === 0) {
        toast({
          title: "No deliveries found",
          description: "No delivered products found for this customer in the selected period",
        });
      } else {
        toast({
          title: "Data loaded",
          description: `Found ${items.length} products from ${totalDeliveries} deliveries`,
        });
      }
    } catch (error: any) {
      console.error("Error fetching delivery data:", error);
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [customerId, periodStart, periodEnd, products, toast]);

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
      is_addon: true, // Manual items are treated as add-ons
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
      
      // If product is selected, auto-fill rate and unit
      if (field === "product_id") {
        const product = products.find(p => p.id === value);
        if (product) {
          updated.product_name = product.name;
          updated.rate = product.base_price;
          updated.unit = product.unit;
          updated.tax_percentage = product.tax_percentage || 0;
        }
      }
      
      // Recalculate amount
      const baseAmount = updated.quantity * updated.rate;
      const taxAmount = (baseAmount * updated.tax_percentage) / 100;
      updated.amount = baseAmount + taxAmount;
      
      return updated;
    }));
  };

  // Calculate totals
  const subscriptionItems = lineItems.filter(i => !i.is_addon);
  const addonItems = lineItems.filter(i => i.is_addon);
  
  // Compute subtotal as pre-tax base amounts only
  const subscriptionTotal = subscriptionItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const addonTotal = addonItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const subtotal = subscriptionTotal + addonTotal;
  
  const totalTax = lineItems.reduce((sum, item) => {
    const baseAmount = item.quantity * item.rate;
    return sum + (baseAmount * item.tax_percentage) / 100;
  }, 0);
  
  // grandTotal = subtotal + tax - discount (arithmetically consistent)
  const grandTotal = subtotal + totalTax - discountAmount;

  const generateInvoiceNumber = async (): Promise<string> => {
    const date = new Date();
    const prefix = `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .like("invoice_number", `${prefix}%`);
    return `${prefix}-${String((count || 0) + 1).padStart(4, "0")}`;
  };

  const handleCreateInvoice = async () => {
    if (!customerId) {
      toast({
        title: "Validation Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }

    if (lineItems.length === 0 || lineItems.every(item => item.amount === 0)) {
      toast({
        title: "Validation Error",
        description: "Please add at least one line item with quantity and rate",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    
    // Format line items for notes (to store item details)
    const subscriptionDetail = subscriptionItems
      .filter(item => item.product_id && item.quantity > 0)
      .map(item => `${item.product_name}: ${item.quantity} ${item.unit} @ ₹${item.rate}/${item.unit}`)
      .join("; ");
    
    const addonDetail = addonItems
      .filter(item => item.product_id && item.quantity > 0)
      .map(item => `[ADD-ON] ${item.product_name}: ${item.quantity} ${item.unit} @ ₹${item.rate}/${item.unit}`)
      .join("; ");
    
    const allDetails = [subscriptionDetail, addonDetail].filter(Boolean).join(" | ");

    const invoiceNumber = await generateInvoiceNumber();

    // Fetch current UPI handle from dairy settings
    const { data: dairySettings } = await supabase
      .from("dairy_settings")
      .select("upi_handle")
      .limit(1)
      .single();

    const { error } = await supabase.from("invoices").insert({
      invoice_number: invoiceNumber,
      customer_id: customerId,
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
      total_amount: subtotal,
      tax_amount: totalTax,
      discount_amount: discountAmount,
      final_amount: grandTotal,
      payment_status: "pending",
      due_date: format(new Date(new Date().setDate(new Date().getDate() + 15)), "yyyy-MM-dd"),
      notes: allDetails || null,
      upi_handle: dairySettings?.upi_handle || null,
    });

    if (error) {
      toast({
        title: "Error creating invoice",
        description: error.message,
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    // Atomic ledger entry with running balance (prevents race conditions)
    await supabase.rpc("insert_ledger_with_balance", {
      _customer_id: customerId,
      _transaction_date: new Date().toISOString().split("T")[0],
      _transaction_type: "invoice",
      _description: `Invoice ${invoiceNumber} (${format(new Date(periodStart), "dd MMM")} - ${format(new Date(periodEnd), "dd MMM")})`,
      _debit_amount: grandTotal,
      _credit_amount: 0,
    });

    setSaving(false);
    toast({
      title: "Invoice created",
      description: `Invoice ${invoiceNumber} generated successfully`,
    });
    
    onComplete();
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Smart Invoice Creator
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Auto-calculates from delivered products • Editable before saving
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ScrollArea className="flex-1 pr-4 max-h-[60vh]">
          <div className="grid gap-4 py-4">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Select value={customerId} onValueChange={(v) => {
                setCustomerId(v);
                setDataFetched(false);
                setLineItems([]);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period Selection with Fetch Button */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 items-end">
              <div className="space-y-2">
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => {
                    setPeriodStart(e.target.value);
                    setDataFetched(false);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => {
                    setPeriodEnd(e.target.value);
                    setDataFetched(false);
                  }}
                />
              </div>
              <Button 
                onClick={fetchDeliveryData}
                disabled={!customerId || loading}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {dataFetched ? "Refresh" : "Fetch Data"}
              </Button>
            </div>

            {/* Info Banner */}
            {dataFetched && deliveryCount > 0 && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center gap-3">
                <Package className="h-5 w-5 text-primary" />
                <div className="text-sm">
                  <span className="font-medium">{deliveryCount} deliveries</span> found for this period.
                  {addonItems.length > 0 && (
                    <span className="text-muted-foreground ml-1">
                      Includes <span className="text-warning font-medium">{addonItems.length} add-on(s)</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {!dataFetched && customerId && (
              <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
                <AlertCircle className="h-5 w-5 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select period and click "Fetch Data" to load deliveries</p>
              </div>
            )}

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

            {/* Empty State or Add Button */}
            {lineItems.length === 0 && dataFetched && (
              <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground">
                <p>No delivered products found</p>
                <p className="text-sm">Add items manually below</p>
              </div>
            )}

            {/* Add Manual Item */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLineItem}
              className="gap-1 w-fit"
            >
              <Plus className="h-4 w-4" /> Add Item Manually
            </Button>

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
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateInvoice} disabled={saving || lineItems.length === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Invoice
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );

  // Helper function to render items table
  function renderItemsTable(items: LineItem[], isAddon: boolean) {
    return (
      <div className="space-y-2">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
          <div className="col-span-4">Product</div>
          <div className="col-span-2 text-center">Qty</div>
          <div className="col-span-2 text-right">Rate (₹)</div>
          <div className="col-span-3 text-right">Amount</div>
          <div className="col-span-1"></div>
        </div>

        {/* Items */}
        {items.map((item) => (
          <div key={item.id} className={`grid grid-cols-12 gap-2 items-center rounded-lg p-1 ${isAddon ? 'bg-warning/5' : ''}`}>
            <div className="col-span-4">
              {item.product_id ? (
                <span className="text-sm font-medium">{item.product_name}</span>
              ) : (
                <Select
                  value={item.product_id}
                  onValueChange={(v) => updateLineItem(item.id, "product_id", v)}
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => removeLineItem(item.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }
}
