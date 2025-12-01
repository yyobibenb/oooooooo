import { useState, useEffect, useCallback } from "react";
import { Switch, Route } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";

const AUTH_KEY = "cryptoarb_auth";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold">404 Not Found</h1>
            <p className="text-muted-foreground mt-2">Page not found</p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const verifyAuth = useCallback(async (token: string): Promise<boolean> => {
    try {
      const response = await apiRequest("POST", "/api/auth/verify", { token });
      const data = await response.json();
      return data.valid === true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem(AUTH_KEY);
      if (savedToken) {
        const valid = await verifyAuth(savedToken);
        setIsAuthenticated(valid);
        if (!valid) {
          localStorage.removeItem(AUTH_KEY);
        }
      } else {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, [verifyAuth]);

  const handleLogin = async (password: string): Promise<boolean> => {
    try {
      const response = await apiRequest("POST", "/api/auth/login", { password });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem(AUTH_KEY, password);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <Login onLogin={handleLogin} />
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
