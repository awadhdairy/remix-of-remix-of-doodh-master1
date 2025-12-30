import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Droplets, Phone, Lock, User, Loader2 } from "lucide-react";
import { z } from "zod";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const loginSchema = z.object({
  phone: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number too long")
    .regex(/^[0-9+\-\s]+$/, "Invalid phone number format"),
  pin: z.string().length(4, "PIN must be exactly 4 digits"),
});

const signupSchema = z.object({
  phone: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number too long")
    .regex(/^[0-9+\-\s]+$/, "Invalid phone number format"),
  pin: z.string().length(4, "PIN must be exactly 4 digits"),
  confirmPin: z.string().length(4, "PIN must be exactly 4 digits"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
}).refine(data => data.pin === data.confirmPin, {
  message: "PINs don't match",
  path: ["confirmPin"],
});

export default function Auth() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/dashboard');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Format phone to create a unique email-like identifier
  const phoneToEmail = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    return `${cleanPhone}@doodhwallah.app`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      loginSchema.parse({ phone, pin });
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

    // Use phone as email identifier for Supabase auth
    const email = phoneToEmail(phone);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pin,
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Login failed",
        description: error.message === "Invalid login credentials" 
          ? "Invalid mobile number or PIN. Please try again."
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "Successfully logged in.",
      });
      navigate('/dashboard');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
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

    setLoading(false);

    if (error) {
      if (error.message.includes("already registered")) {
        toast({
          title: "Account exists",
          description: "This mobile number is already registered. Please login instead.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Signup failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Account created!",
        description: "Welcome to Doodh Wallah. You are now logged in.",
      });
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden w-1/2 gradient-hero lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12">
        <div className="max-w-md text-center animate-fade-in">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-sidebar-primary shadow-glow">
            <Droplets className="h-10 w-10 text-sidebar-primary-foreground" />
          </div>
          <h1 className="mb-4 text-4xl font-bold text-sidebar-foreground">
            Doodh Wallah
          </h1>
          <p className="text-lg text-sidebar-foreground/80">
            Complete Dairy Management Solution
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4 text-left">
            {[
              "Cattle Management",
              "Milk Production Tracking",
              "Customer Billing",
              "Delivery Routes",
              "Health Records",
              "Financial Reports",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
                <div className="h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="flex w-full items-center justify-center bg-background p-6 lg:w-1/2">
        <Card className="w-full max-w-md border-border/50 shadow-lg animate-slide-up">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary lg:hidden">
              <Droplets className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">Welcome</CardTitle>
            <CardDescription>
              Sign in with your mobile number & PIN
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-phone">Mobile Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="login-phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-xs text-destructive">{errors.phone}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-pin">4-Digit PIN</Label>
                    <div className="flex justify-center">
                      <InputOTP 
                        maxLength={4} 
                        value={pin} 
                        onChange={setPin}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {errors.pin && (
                      <p className="text-xs text-destructive text-center">{errors.pin}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-6">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Your name"
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
                    <Label htmlFor="signup-phone">Mobile Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-xs text-destructive">{errors.phone}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-pin">Create 4-Digit PIN</Label>
                    <div className="flex justify-center">
                      <InputOTP 
                        maxLength={4} 
                        value={pin} 
                        onChange={setPin}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {errors.pin && (
                      <p className="text-xs text-destructive text-center">{errors.pin}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-pin">Confirm PIN</Label>
                    <div className="flex justify-center">
                      <InputOTP 
                        maxLength={4} 
                        value={confirmPin} 
                        onChange={setConfirmPin}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
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
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}