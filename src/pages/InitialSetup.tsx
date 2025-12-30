import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Droplets, Phone, User, Loader2 } from "lucide-react";
import { z } from "zod";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const signupSchema = z.object({
  phone: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number too long")
    .regex(/^[0-9+\-\s]+$/, "Invalid phone number format"),
  pin: z.string().length(6, "PIN must be exactly 6 digits"),
  confirmPin: z.string().length(6, "PIN must be exactly 6 digits"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
}).refine(data => data.pin === data.confirmPin, {
  message: "PINs don't match",
  path: ["confirmPin"],
});

export default function InitialSetup() {
  const [phone, setPhone] = useState("7897716792");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  const phoneToEmail = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    return `${cleanPhone}@doodhwallah.app`;
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      signupSchema.parse({ phone, pin, confirmPin, fullName });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) newErrors[e.path[0] as string] = e.message;
        });
        setErrors(newErrors);
        return;
      }
    }

    setLoading(true);

    const email = phoneToEmail(phone);
    const redirectUrl = `${window.location.origin}/dashboard`;

    const { error } = await supabase.auth.signUp({
      email,
      password: pin,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone: phone.replace(/[^0-9]/g, ''),
          pin: pin,
        },
      },
    });

    if (error) {
      setLoading(false);
      toast({
        title: "Setup failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Call the setup_initial_admin function to promote to super_admin
    const { error: rpcError } = await supabase.rpc('setup_initial_admin');
    
    setLoading(false);

    if (rpcError) {
      console.error("Failed to promote to admin:", rpcError);
    }

    toast({
      title: "Admin account created!",
      description: "You are now the super admin. Redirecting to dashboard...",
    });
    
    navigate('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-border/50 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Droplets className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Initial Setup</CardTitle>
          <CardDescription>
            Create the super admin account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="setup-name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="setup-name"
                  type="text"
                  placeholder="Admin Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.fullName && (
                <p className="text-xs text-destructive">{errors.fullName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-phone">Mobile Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="setup-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                  readOnly
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-pin">Create 6-Digit PIN</Label>
              <div className="flex justify-center">
                <InputOTP 
                  maxLength={6} 
                  value={pin} 
                  onChange={setPin}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {errors.pin && (
                <p className="text-xs text-destructive text-center">{errors.pin}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-confirm-pin">Confirm PIN</Label>
              <div className="flex justify-center">
                <InputOTP 
                  maxLength={6} 
                  value={confirmPin} 
                  onChange={setConfirmPin}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {errors.confirmPin && (
                <p className="text-xs text-destructive text-center">{errors.confirmPin}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Admin...
                </>
              ) : (
                "Create Super Admin"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
