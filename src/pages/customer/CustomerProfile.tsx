import { useState, useEffect } from 'react';
import { User, Phone, MapPin, Mail, Lock, LogOut, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { externalSupabase as supabase } from '@/lib/external-supabase';
import { useNavigate } from 'react-router-dom';
// Fallback for loading state
const fallbackData = {
  name: 'Loading...',
  phone: '',
  email: '',
  address: ''
};

export default function CustomerProfile() {
  const { customerData, customerId, logout, changePin, refreshCustomerData } = useCustomerAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  
  // Use fallback data if customerData is loading
  const displayData = customerData || fallbackData;
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');

  // Update form fields when customerData loads
  useEffect(() => {
    if (customerData) {
      setName(customerData.name || '');
      setEmail(customerData.email || '');
      setAddress(customerData.address || '');
    }
  }, [customerData]);
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!customerId) return;
    setSaving(true);
    const { error } = await supabase.from('customers').update({ name, email, address }).eq('id', customerId);
    setSaving(false);
    if (!error) {
      toast({ title: "Profile updated" });
      refreshCustomerData();
      setEditing(false);
    }
  };

  const handleChangePin = async () => {
    const result = await changePin(currentPin, newPin);
    if (result.success) {
      toast({ title: "PIN changed successfully" });
      setCurrentPin('');
      setNewPin('');
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/customer/auth');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Personal Information</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3"><User className="h-4 w-4 text-muted-foreground" />
            {editing ? <Input value={name} onChange={e => setName(e.target.value)} placeholder="Name" /> : <span>{displayData.name}</span>}
          </div>
          <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span>{displayData.phone}</span></div>
          <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" />
            {editing ? <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" /> : <span>{displayData.email || 'Not set'}</span>}
          </div>
          <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-muted-foreground" />
            {editing ? <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" /> : <span>{displayData.address || 'Not set'}</span>}
          </div>
          {editing && <Button onClick={handleSaveProfile} disabled={saving} className="w-full">{saving ? 'Saving...' : 'Save Changes'}</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Security</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Dialog>
            <DialogTrigger asChild><Button variant="outline" className="w-full"><Lock className="mr-2 h-4 w-4" />Change PIN</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Change PIN</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div><Label>Current PIN</Label><Input type="password" value={currentPin} onChange={e => setCurrentPin(e.target.value)} maxLength={6} /></div>
                <div><Label>New PIN (6 digits)</Label><Input type="password" value={newPin} onChange={e => setNewPin(e.target.value)} maxLength={6} /></div>
                <Button onClick={handleChangePin} disabled={currentPin.length !== 6 || newPin.length !== 6} className="w-full">Update PIN</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Support</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-muted-foreground"><HelpCircle className="h-4 w-4" /><span>Contact: support@awadhdairy.com</span></div>
          <div className="flex items-center gap-3 text-muted-foreground mt-2"><Phone className="h-4 w-4" /><span>Call: +91 XXXXXXXXXX</span></div>
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />Logout</Button>
    </div>
  );
}
