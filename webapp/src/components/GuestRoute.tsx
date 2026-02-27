import { Navigate } from "react-router-dom";
import { useSupabaseSession } from "@/lib/supabase-auth";

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSupabaseSession();

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="font-dm text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (session?.user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
