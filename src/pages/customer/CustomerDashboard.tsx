import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Package, Calendar, Receipt, TrendingUp, 
  Pause, Play, ChevronRight, AlertCircle 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { supabase } from '@/integrations/supabase/client';

interface DeliverySummary {
  pending: number;
  delivered: number;
  total: number;
}

interface SubscriptionItem {
  id: string;
  product_name: string;
  quantity: number;
  custom_price: number | null;
  is_active: boolean;
}

// Dummy data
const dummyDeliverySummary: DeliverySummary = { pending: 0, delivered: 1, total: 1 };
const dummySubscriptionItems: SubscriptionItem[] = [
  { id: '1', product_name: 'Full Cream Milk', quantity: 2, custom_price: null, is_active: true },
  { id: '2', product_name: 'Buffalo Milk', quantity: 1, custom_price: 65, is_active: true },
  { id: '3', product_name: 'Fresh Curd', quantity: 0.5, custom_price: null, is_active: true },
];

export default function CustomerDashboard() {
  const { customerData, customerId, refreshCustomerData } = useCustomerAuth();
  const navigate = useNavigate();
  const [deliverySummary, setDeliverySummary] = useState<DeliverySummary>(dummyDeliverySummary);
  const [subscriptionItems, setSubscriptionItems] = useState<SubscriptionItem[]>(dummySubscriptionItems);
  const [isOnVacation, setIsOnVacation] = useState(false);
  const [loading, setLoading] = useState(false);

  // Use dummy balance data
  const creditBalance = 2500;
  const advanceBalance = 0;
  const outstandingBalance = creditBalance - advanceBalance;

  return (
    <div className="space-y-6">
      {/* Vacation Banner */}
      {isOnVacation && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="flex items-center gap-3 py-4">
            <Pause className="h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium text-amber-800 dark:text-amber-200">Deliveries Paused</p>
              <p className="text-sm text-amber-600 dark:text-amber-400">Your subscription is currently on vacation</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/customer/subscription')}>
              Manage
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Balance Card */}
      <Card className={outstandingBalance > 0 ? "border-destructive" : "border-green-500"}>
        <CardHeader className="pb-2">
          <CardDescription>Outstanding Balance</CardDescription>
          <CardTitle className={`text-3xl ${outstandingBalance > 0 ? 'text-destructive' : 'text-green-600'}`}>
            ₹{Math.abs(outstandingBalance).toFixed(2)}
            {outstandingBalance < 0 && <span className="text-sm font-normal ml-2">(Credit)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Due: ₹{creditBalance.toFixed(2)}</span>
            <span>Advance: ₹{advanceBalance.toFixed(2)}</span>
          </div>
          <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/customer/billing')}>
            <Receipt className="mr-2 h-4 w-4" />
            View Billing Details
          </Button>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/customer/deliveries')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-full p-3">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{deliverySummary.delivered}/{deliverySummary.total}</p>
                <p className="text-sm text-muted-foreground">Today's Deliveries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/customer/subscription')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-full p-3">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{subscriptionItems.filter(s => s.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Active Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">My Subscription</CardTitle>
            <CardDescription>Your daily milk products</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/customer/subscription')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : subscriptionItems.length === 0 ? (
            <div className="text-center py-6">
              <Package className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No active subscription</p>
              <Button variant="link" onClick={() => navigate('/customer/subscription')}>
                Browse Products
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {subscriptionItems.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant={item.is_active ? "default" : "secondary"}>
                      {item.is_active ? 'Active' : 'Paused'}
                    </Badge>
                    <span className="font-medium">{item.product_name}</span>
                  </div>
                  <span className="text-muted-foreground">{item.quantity}x daily</span>
                </div>
              ))}
              {subscriptionItems.length > 3 && (
                <Button variant="ghost" className="w-full" onClick={() => navigate('/customer/subscription')}>
                  +{subscriptionItems.length - 3} more products
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button 
          variant="outline" 
          className="h-auto py-4 flex-col gap-2"
          onClick={() => navigate('/customer/subscription')}
        >
          {isOnVacation ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          <span>{isOnVacation ? 'Resume Delivery' : 'Pause Delivery'}</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex-col gap-2"
          onClick={() => navigate('/customer/profile')}
        >
          <AlertCircle className="h-5 w-5" />
          <span>Get Support</span>
        </Button>
      </div>
    </div>
  );
}
