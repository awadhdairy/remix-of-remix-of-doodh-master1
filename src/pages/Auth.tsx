import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStaffAuth } from "@/contexts/StaffAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Phone, Loader2 } from "lucide-react";
import { z } from "zod";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import awadhDairyLogo from "@/assets/awadh-dairy-logo.png";

const loginSchema = z.object({
  phone: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number too long")
    .regex(/^[0-9]+$/, "Phone number must contain only digits"),
  pin: z.string().length(6, "PIN must be exactly 6 digits"),
});

export default function Auth() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, login, bootstrap } = useStaffAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  const handleBootstrap = async () => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
    if (cleanPhone.length < 10 || pin.length !== 6) {
      toast({
        title: "Invalid credentials",
        description: "Please enter valid phone number and 6-digit PIN.",
        variant: "destructive",
      });
      return;
    }

    setBootstrapping(true);

    try {
      const result = await bootstrap(cleanPhone, pin);

      if (!result.success) {
        toast({
          title: "Bootstrap failed",
          description: result.error || "Could not create admin account.",
          variant: "destructive",
        });
        setBootstrapping(false);
        return;
      }

      toast({
        title: "Admin account ready",
        description: result.message || "You can now sign in with your credentials.",
      });

      // Now try to login
      setBootstrapping(false);
      await handleLogin();
    } catch (err) {
      toast({
        title: "Bootstrap failed",
        description: "Could not create admin account. Please try again.",
        variant: "destructive",
      });
      setBootstrapping(false);
    }
  };

  const handleLogin = async () => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    try {
      loginSchema.parse({ phone: cleanPhone, pin });
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

    const result = await login(cleanPhone, pin);

    setLoading(false);

    if (!result.success) {
      toast({
        title: "Login failed",
        description: result.error || "Invalid mobile number or PIN. Please try again.",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    await handleLogin();
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const showBootstrapOption = cleanPhone.length >= 10 && pin.length === 6;

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden w-1/2 gradient-hero lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12">
        <div className="max-w-md text-center animate-fade-in">
          <img 
            src={awadhDairyLogo} 
            alt="Awadh Dairy" 
            className="mx-auto mb-6 h-32 w-32 object-contain"
          />
          <h1 className="mb-4 text-4xl font-bold text-sidebar-foreground">
            Awadh Dairy
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

      {/* Right side - Login form only */}
      <div className="flex w-full items-center justify-center bg-background p-6 lg:w-1/2">
        <Card className="w-full max-w-md border-border/50 shadow-lg animate-slide-up">
          <CardHeader className="text-center">
            <img 
              src={awadhDairyLogo} 
              alt="Awadh Dairy" 
              className="mx-auto mb-2 h-16 w-16 object-contain lg:hidden"
            />
            <CardTitle className="text-2xl font-bold">Welcome</CardTitle>
            <CardDescription>
              Sign in with your mobile number & PIN
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-phone">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-phone"
                    type="tel"
                    placeholder="Enter mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="pl-10"
                    maxLength={15}
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-pin">6-Digit PIN</Label>
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
              
              <Button type="submit" className="w-full" disabled={loading || bootstrapping}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>

              {showBootstrapOption && (
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full" 
                  disabled={loading || bootstrapping}
                  onClick={handleBootstrap}
                >
                  {bootstrapping ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    "Setup Admin Account"
                  )}
                </Button>
              )}
              
              <p className="text-xs text-center text-muted-foreground mt-4">
                Contact your administrator for account access
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
