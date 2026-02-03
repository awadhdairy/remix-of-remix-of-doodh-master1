import { useState, useEffect } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { Milk, Edit, Trash2, Plus, Loader2, IndianRupee, AlertTriangle, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  base_price: number;
  tax_percentage: number | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
}

interface DeleteDialogState {
  open: boolean;
  product: Product | null;
  hasSubscriptions: boolean;
  subscriptionCount: number;
}

const emptyFormData = {
  name: "",
  category: "milk",
  unit: "liter",
  base_price: "",
  tax_percentage: "",
  description: "",
};

const categoryColors: Record<string, string> = {
  milk: "bg-info/10 text-info border-info/20",
  curd: "bg-warning/10 text-warning border-warning/20",
  paneer: "bg-success/10 text-success border-success/20",
  ghee: "bg-primary/10 text-primary border-primary/20",
  butter: "bg-accent/10 text-accent border-accent/20",
  other: "bg-muted text-muted-foreground border-border",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogState, setDeleteDialogState] = useState<DeleteDialogState>({
    open: false,
    product: null,
    hasSubscriptions: false,
    subscriptionCount: 0,
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("category")
      .order("name");

    if (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error fetching products",
        description: parseErrorMessage(error.message),
        variant: "destructive",
      });
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const parseErrorMessage = (errorMessage: string): string => {
    if (errorMessage.includes("violates row-level security policy")) {
      return "You don't have permission to perform this action. Please contact an administrator.";
    }
    if (errorMessage.includes("violates foreign key constraint")) {
      return "This product is linked to other records and cannot be deleted directly.";
    }
    if (errorMessage.includes("duplicate key")) {
      return "A product with this name already exists.";
    }
    return errorMessage;
  };

  const checkProductDependencies = async (productId: string): Promise<number> => {
    const { count, error } = await supabase
      .from("customer_products")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);
    
    if (error) {
      console.error("Error checking dependencies:", error);
      return 0;
    }
    return count || 0;
  };

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setSelectedProduct(product);
      setFormData({
        name: product.name,
        category: product.category,
        unit: product.unit,
        base_price: product.base_price.toString(),
        tax_percentage: product.tax_percentage?.toString() || "",
        description: product.description || "",
      });
    } else {
      setSelectedProduct(null);
      setFormData(emptyFormData);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.base_price) {
      toast({
        title: "Validation Error",
        description: "Name and price are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const payload = {
      name: formData.name,
      category: formData.category,
      unit: formData.unit,
      base_price: parseFloat(formData.base_price),
      tax_percentage: formData.tax_percentage ? parseFloat(formData.tax_percentage) : null,
      description: formData.description || null,
    };

    const { error } = selectedProduct
      ? await supabase.from("products").update(payload).eq("id", selectedProduct.id)
      : await supabase.from("products").insert(payload);

    setSaving(false);

    if (error) {
      console.error("Error saving product:", error);
      toast({
        title: "Error saving product",
        description: parseErrorMessage(error.message),
        variant: "destructive",
      });
    } else {
      toast({
        title: selectedProduct ? "Product updated" : "Product added",
        description: `${formData.name} has been saved successfully`,
      });
      setDialogOpen(false);
      fetchProducts();
    }
  };

  const handleDeleteClick = async (product: Product) => {
    // Check for active subscriptions before showing delete dialog
    const subscriptionCount = await checkProductDependencies(product.id);
    
    setDeleteDialogState({
      open: true,
      product,
      hasSubscriptions: subscriptionCount > 0,
      subscriptionCount,
    });
  };

  const handleDelete = async () => {
    if (!deleteDialogState.product) return;
    
    setDeleting(true);
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", deleteDialogState.product.id);

    setDeleting(false);

    if (error) {
      console.error("Error deleting product:", error);
      toast({
        title: "Error deleting product",
        description: parseErrorMessage(error.message),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Product deleted",
        description: `${deleteDialogState.product.name} has been removed`,
      });
      setDeleteDialogState({ open: false, product: null, hasSubscriptions: false, subscriptionCount: 0 });
      fetchProducts();
    }
  };

  const handleSoftDelete = async () => {
    if (!deleteDialogState.product) return;
    
    setDeleting(true);
    const { error } = await supabase
      .from("products")
      .update({ is_active: false })
      .eq("id", deleteDialogState.product.id);

    setDeleting(false);

    if (error) {
      console.error("Error deactivating product:", error);
      toast({
        title: "Error deactivating product",
        description: parseErrorMessage(error.message),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Product deactivated",
        description: `${deleteDialogState.product.name} has been marked as inactive`,
      });
      setDeleteDialogState({ open: false, product: null, hasSubscriptions: false, subscriptionCount: 0 });
      fetchProducts();
    }
  };

  const handleReactivate = async (product: Product) => {
    const { error } = await supabase
      .from("products")
      .update({ is_active: true })
      .eq("id", product.id);

    if (error) {
      console.error("Error reactivating product:", error);
      toast({
        title: "Error reactivating product",
        description: parseErrorMessage(error.message),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Product reactivated",
        description: `${product.name} is now active`,
      });
      fetchProducts();
    }
  };

  const groupedProducts = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your dairy products catalog"
        icon={Milk}
        action={{
          label: "Add Product",
          onClick: () => handleOpenDialog(),
        }}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <Milk className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No products yet</p>
          <p className="text-muted-foreground mb-4">Add your first product to get started</p>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" /> Add Product
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
            <div key={category} className="space-y-4">
              <h2 className="text-lg font-semibold capitalize flex items-center gap-2">
                <Badge variant="outline" className={cn("capitalize", categoryColors[category])}>
                  {category}
                </Badge>
                <span className="text-muted-foreground text-sm font-normal">
                  ({categoryProducts.length} products)
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categoryProducts.map((product, index) => (
                  <Card
                    key={product.id}
                    className={cn(
                      "group transition-all duration-200 hover:shadow-lg animate-slide-up",
                      !product.is_active && "opacity-60"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          <CardDescription className="capitalize">
                            {product.unit}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenDialog(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!product.is_active ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleReactivate(product)}
                              title="Reactivate product"
                            >
                              <Plus className="h-4 w-4 text-success" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDeleteClick(product)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-baseline gap-1">
                        <IndianRupee className="h-4 w-4 text-muted-foreground" />
                        <span className="text-2xl font-bold">
                          {Number(product.base_price).toLocaleString()}
                        </span>
                        <span className="text-sm text-muted-foreground">/{product.unit}</span>
                      </div>
                      {product.tax_percentage && product.tax_percentage > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          + {product.tax_percentage}% tax
                        </p>
                      )}
                      {product.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      {!product.is_active && (
                        <Badge variant="outline" className="mt-2 bg-destructive/10 text-destructive">
                          Inactive
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
            <DialogDescription>
              {selectedProduct
                ? "Update product information"
                : "Enter details for the new product"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Cow Milk"
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    setFormData({ ...formData, category: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="milk">Milk</SelectItem>
                    <SelectItem value="curd">Curd</SelectItem>
                    <SelectItem value="paneer">Paneer</SelectItem>
                    <SelectItem value="ghee">Ghee</SelectItem>
                    <SelectItem value="butter">Butter</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(v) =>
                    setFormData({ ...formData, unit: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="liter">Liter</SelectItem>
                    <SelectItem value="kg">Kilogram</SelectItem>
                    <SelectItem value="500ml">500ml</SelectItem>
                    <SelectItem value="250ml">250ml</SelectItem>
                    <SelectItem value="piece">Piece</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="base_price">Price (₹) *</Label>
                <Input
                  id="base_price"
                  type="number"
                  step="0.5"
                  value={formData.base_price}
                  onChange={(e) =>
                    setFormData({ ...formData, base_price: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_percentage">Tax %</Label>
                <Input
                  id="tax_percentage"
                  type="number"
                  step="0.5"
                  value={formData.tax_percentage}
                  onChange={(e) =>
                    setFormData({ ...formData, tax_percentage: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Product description..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedProduct ? "Update" : "Add"} Product
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Delete Confirmation */}
      <Dialog 
        open={deleteDialogState.open} 
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogState({ open: false, product: null, hasSubscriptions: false, subscriptionCount: 0 });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {deleteDialogState.hasSubscriptions && (
                <AlertTriangle className="h-5 w-5 text-warning" />
              )}
              Delete Product
            </DialogTitle>
            <DialogDescription>
              {deleteDialogState.hasSubscriptions ? (
                <span className="text-warning">
                  This product has {deleteDialogState.subscriptionCount} active customer subscription(s). 
                  Deleting it will remove all related subscriptions and delivery history.
                </span>
              ) : (
                `Are you sure you want to delete ${deleteDialogState.product?.name}? This action cannot be undone.`
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 pt-4">
            {deleteDialogState.hasSubscriptions && (
              <Button 
                variant="outline" 
                onClick={handleSoftDelete}
                disabled={deleting}
                className="w-full"
              >
                {deleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <EyeOff className="mr-2 h-4 w-4" />
                )}
                Deactivate Instead (Recommended)
              </Button>
            )}
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setDeleteDialogState({ open: false, product: null, hasSubscriptions: false, subscriptionCount: 0 })}
                className="flex-1"
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1"
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {deleteDialogState.hasSubscriptions ? "Delete Anyway" : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
