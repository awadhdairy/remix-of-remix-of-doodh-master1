import { useEffect, useState } from 'react';
import { Plus, Minus, Pause, Play, Package, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays } from 'date-fns';

interface SubscriptionProduct {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  custom_price: number | null;
  base_price: number;
  is_active: boolean;
}

export default function CustomerSubscription() {
  const { customerId } = useCustomerAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [vacationStart, setVacationStart] = useState('');
  const [vacationEnd, setVacationEnd] = useState('');
  const [savingVacation, setSavingVacation] = useState(false);

  useEffect(() => {
    if (customerId) fetchProducts();
  }, [customerId]);

  const fetchProducts = async () => {
    if (!customerId) return;
    const { data } = await supabase
      .from('customer_products')
      .select('*, products(name, base_price)')
      .eq('customer_id', customerId);
    
    if (data) {
      setProducts(data.map((p: any) => ({
        id: p.id,
        product_id: p.product_id,
        product_name: p.products?.name || 'Unknown',
        quantity: p.quantity,
        custom_price: p.custom_price,
        base_price: p.products?.base_price || 0,
        is_active: p.is_active
      })));
    }
    setLoading(false);
  };

  const updateQuantity = async (id: string, newQty: number) => {
    if (newQty < 0) return;
    await supabase.from('customer_products').update({ quantity: newQty }).eq('id', id);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, quantity: newQty } : p));
    toast({ title: "Quantity updated" });
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await supabase.from('customer_products').update({ is_active: isActive }).eq('id', id);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: isActive } : p));
    toast({ title: isActive ? "Product activated" : "Product paused" });
  };

  const scheduleVacation = async () => {
    if (!customerId || !vacationStart || !vacationEnd) return;
    setSavingVacation(true);
    const { error } = await supabase.from('customer_vacations').insert({
      customer_id: customerId,
      start_date: vacationStart,
      end_date: vacationEnd,
      is_active: true
    });
    setSavingVacation(false);
    if (!error) {
      toast({ title: "Vacation scheduled", description: `Deliveries paused from ${vacationStart} to ${vacationEnd}` });
      setVacationStart('');
      setVacationEnd('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Subscription</h1>
          <p className="text-muted-foreground">Manage your daily products</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline"><Pause className="mr-2 h-4 w-4" />Pause</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule Vacation</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input type="date" value={vacationStart} onChange={e => setVacationStart(e.target.value)} min={format(new Date(), 'yyyy-MM-dd')} />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input type="date" value={vacationEnd} onChange={e => setVacationEnd(e.target.value)} min={vacationStart || format(new Date(), 'yyyy-MM-dd')} />
              </div>
              <Button onClick={scheduleVacation} disabled={savingVacation || !vacationStart || !vacationEnd} className="w-full">
                {savingVacation ? 'Saving...' : 'Schedule Pause'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i}><CardContent className="h-20 animate-pulse bg-muted" /></Card>)}</div>
      ) : products.length === 0 ? (
        <Card><CardContent className="py-10 text-center"><Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" /><p>No products in subscription</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {products.map(product => (
            <Card key={product.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch checked={product.is_active} onCheckedChange={v => toggleActive(product.id, v)} />
                    <div>
                      <p className="font-medium">{product.product_name}</p>
                      <p className="text-sm text-muted-foreground">₹{(product.custom_price || product.base_price).toFixed(2)}/unit</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => updateQuantity(product.id, product.quantity - 1)}><Minus className="h-4 w-4" /></Button>
                    <span className="w-8 text-center font-bold">{product.quantity}</span>
                    <Button size="icon" variant="outline" onClick={() => updateQuantity(product.id, product.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
