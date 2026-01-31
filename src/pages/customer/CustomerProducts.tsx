import { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingCart, Milk, Package, Search, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { externalSupabase as supabase } from '@/lib/external-supabase';

interface Product {
  id: string;
  name: string;
  category: string;
  base_price: number;
  unit: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
}

interface SubscribedProduct {
  product_id: string;
  quantity: number;
  custom_price: number | null;
  is_active: boolean;
}

export default function CustomerProducts() {
  const { toast } = useToast();
  const { customerId } = useCustomerAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [subscribedProducts, setSubscribedProducts] = useState<SubscribedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (customerId) {
      fetchData();
    }
  }, [customerId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all active products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Fetch customer's subscribed products
      const { data: subscribedData, error: subscribedError } = await supabase
        .from('customer_products')
        .select('product_id, quantity, custom_price, is_active')
        .eq('customer_id', customerId);

      if (subscribedError) throw subscribedError;
      setSubscribedProducts(subscribedData || []);
    } catch (error: any) {
      toast({
        title: "Error loading products",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getSubscribedProduct = (productId: string) => {
    return subscribedProducts.find(sp => sp.product_id === productId);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setQuantities(prev => {
      const subscribed = getSubscribedProduct(productId);
      const current = prev[productId] ?? (subscribed?.quantity || 0);
      const newQty = Math.max(0, current + delta);
      return { ...prev, [productId]: newQty };
    });
  };

  const getDisplayQuantity = (productId: string) => {
    if (quantities[productId] !== undefined) {
      return quantities[productId];
    }
    const subscribed = getSubscribedProduct(productId);
    return subscribed?.quantity || 0;
  };

  const addToSubscription = async (product: Product) => {
    if (!customerId) return;
    
    const qty = getDisplayQuantity(product.id);
    if (qty <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Please select a quantity greater than 0",
        variant: "destructive",
      });
      return;
    }

    setSaving(product.id);
    try {
      const existingSubscription = getSubscribedProduct(product.id);

      if (existingSubscription) {
        // Update existing subscription
        const { error } = await supabase
          .from('customer_products')
          .update({ quantity: qty, is_active: true })
          .eq('customer_id', customerId)
          .eq('product_id', product.id);

        if (error) throw error;

        setSubscribedProducts(prev => 
          prev.map(sp => 
            sp.product_id === product.id 
              ? { ...sp, quantity: qty, is_active: true }
              : sp
          )
        );

        toast({
          title: "Subscription Updated",
          description: `${product.name} quantity updated to ${qty} ${product.unit}/day`,
        });
      } else {
        // Add new subscription
        const { error } = await supabase
          .from('customer_products')
          .insert({
            customer_id: customerId,
            product_id: product.id,
            quantity: qty,
            is_active: true,
          });

        if (error) throw error;

        setSubscribedProducts(prev => [
          ...prev,
          { product_id: product.id, quantity: qty, custom_price: null, is_active: true }
        ]);

        toast({
          title: "Added to Subscription",
          description: `${qty} ${product.unit} of ${product.name} added to your daily subscription`,
        });
      }

      // Clear the temporary quantity
      setQuantities(prev => {
        const newQty = { ...prev };
        delete newQty[product.id];
        return newQty;
      });
    } catch (error: any) {
      toast({
        title: "Failed to update subscription",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const removeFromSubscription = async (product: Product) => {
    if (!customerId) return;

    setSaving(product.id);
    try {
      const { error } = await supabase
        .from('customer_products')
        .delete()
        .eq('customer_id', customerId)
        .eq('product_id', product.id);

      if (error) throw error;

      setSubscribedProducts(prev => 
        prev.filter(sp => sp.product_id !== product.id)
      );

      setQuantities(prev => {
        const newQty = { ...prev };
        delete newQty[product.id];
        return newQty;
      });

      toast({
        title: "Removed from Subscription",
        description: `${product.name} removed from your subscription`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to remove",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const subscribedCount = subscribedProducts.filter(sp => sp.is_active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">Browse and add to your subscription</p>
        </div>
        {subscribedCount > 0 && (
          <Badge variant="secondary" className="text-sm">
            <ShoppingCart className="h-3 w-3 mr-1" />
            {subscribedCount} subscribed
          </Badge>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Categories */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Products Grid */}
      <div className="grid gap-4">
        {filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">No products found</p>
              <p className="text-muted-foreground">Try a different search term</p>
            </CardContent>
          </Card>
        ) : (
          filteredProducts.map(product => {
            const subscribed = getSubscribedProduct(product.id);
            const displayQty = getDisplayQuantity(product.id);
            const hasChanges = quantities[product.id] !== undefined && quantities[product.id] !== (subscribed?.quantity || 0);
            const isSaving = saving === product.id;
            
            return (
              <Card key={product.id} className="overflow-hidden">
                <CardContent className="pt-4">
                  <div className="flex gap-4">
                    {/* Product Icon */}
                    <div className="bg-primary/10 rounded-lg p-4 flex-shrink-0">
                      <Milk className="h-8 w-8 text-primary" />
                    </div>
                    
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{product.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {product.description || `Fresh ${product.name.toLowerCase()}`}
                          </p>
                        </div>
                        {subscribed && subscribed.is_active && (
                          <Badge variant="secondary" className="flex-shrink-0">
                            {subscribed.quantity} {product.unit}/day
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <div>
                          <p className="text-lg font-bold text-primary">
                            ₹{subscribed?.custom_price || product.base_price}
                          </p>
                          <p className="text-xs text-muted-foreground">per {product.unit}</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-8 w-8"
                            onClick={() => updateQuantity(product.id, -1)}
                            disabled={displayQty <= 0 || isSaving}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-bold">{displayQty}</span>
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-8 w-8"
                            onClick={() => updateQuantity(product.id, 1)}
                            disabled={isSaving}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          
                          {displayQty > 0 && (hasChanges || !subscribed) && (
                            <Button 
                              size="sm"
                              onClick={() => addToSubscription(product)}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : subscribed ? (
                                'Update'
                              ) : (
                                'Add'
                              )}
                            </Button>
                          )}
                          
                          {subscribed && displayQty === 0 && (
                            <Button 
                              size="sm"
                              variant="destructive"
                              onClick={() => removeFromSubscription(product)}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Remove'
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
