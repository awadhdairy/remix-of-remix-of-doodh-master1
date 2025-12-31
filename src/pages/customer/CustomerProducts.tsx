import { useState } from 'react';
import { Plus, Minus, ShoppingCart, Milk, Package, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  description: string;
  image?: string;
  inSubscription: boolean;
}

// Dummy product data
const dummyProducts: Product[] = [
  { id: '1', name: 'Full Cream Milk', category: 'Milk', price: 60, unit: 'liter', description: 'Fresh full cream cow milk with 6% fat content', inSubscription: true },
  { id: '2', name: 'Toned Milk', category: 'Milk', price: 52, unit: 'liter', description: 'Low fat toned milk with 3% fat content', inSubscription: false },
  { id: '3', name: 'Double Toned Milk', category: 'Milk', price: 48, unit: 'liter', description: 'Double toned milk with 1.5% fat content', inSubscription: false },
  { id: '4', name: 'Buffalo Milk', category: 'Milk', price: 70, unit: 'liter', description: 'Rich buffalo milk with 8% fat content', inSubscription: true },
  { id: '5', name: 'A2 Cow Milk', category: 'Milk', price: 80, unit: 'liter', description: 'Premium A2 protein cow milk from desi cows', inSubscription: false },
  { id: '6', name: 'Fresh Curd', category: 'Dairy', price: 55, unit: 'kg', description: 'Thick and creamy homemade style curd', inSubscription: true },
  { id: '7', name: 'Paneer', category: 'Dairy', price: 320, unit: 'kg', description: 'Fresh cottage cheese made from full cream milk', inSubscription: false },
  { id: '8', name: 'Fresh Butter', category: 'Dairy', price: 450, unit: 'kg', description: 'Hand churned fresh white butter', inSubscription: false },
  { id: '9', name: 'Buttermilk', category: 'Dairy', price: 30, unit: 'liter', description: 'Refreshing spiced buttermilk', inSubscription: false },
  { id: '10', name: 'Ghee', category: 'Dairy', price: 550, unit: 'kg', description: 'Pure desi cow ghee, bilona method', inSubscription: false },
];

const categories = ['All', 'Milk', 'Dairy'];

export default function CustomerProducts() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const filteredProducts = dummyProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const updateQuantity = (productId: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[productId] || 0;
      const newQty = Math.max(0, current + delta);
      return { ...prev, [productId]: newQty };
    });
  };

  const addToSubscription = (product: Product) => {
    const qty = quantities[product.id] || 1;
    toast({
      title: "Added to Subscription",
      description: `${qty}x ${product.name} added to your daily subscription`,
    });
    setQuantities(prev => ({ ...prev, [product.id]: 0 }));
  };

  const cartItemsCount = Object.values(quantities).reduce((sum, qty) => sum + (qty > 0 ? 1 : 0), 0);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">Browse and add to your subscription</p>
        </div>
        {cartItemsCount > 0 && (
          <Button size="sm" className="relative">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Cart
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {cartItemsCount}
            </Badge>
          </Button>
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
        <TabsList className="w-full justify-start">
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
            const qty = quantities[product.id] || 0;
            
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
                          <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                        </div>
                        {product.inSubscription && (
                          <Badge variant="secondary" className="flex-shrink-0">Subscribed</Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <div>
                          <p className="text-lg font-bold text-primary">₹{product.price}</p>
                          <p className="text-xs text-muted-foreground">per {product.unit}</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {qty > 0 ? (
                            <>
                              <Button 
                                size="icon" 
                                variant="outline" 
                                className="h-8 w-8"
                                onClick={() => updateQuantity(product.id, -1)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-8 text-center font-bold">{qty}</span>
                              <Button 
                                size="icon" 
                                variant="outline" 
                                className="h-8 w-8"
                                onClick={() => updateQuantity(product.id, 1)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm"
                                onClick={() => addToSubscription(product)}
                              >
                                Add
                              </Button>
                            </>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateQuantity(product.id, 1)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
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
