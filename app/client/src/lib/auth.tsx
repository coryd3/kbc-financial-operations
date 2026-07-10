import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LEADERSHIP_ROLES, type SafeUser } from "@shared/schema";
import { api, ApiError } from "./api";

interface AuthContextValue {
  user: SafeUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  isLeadership: boolean;
  portalAccess: boolean;
  mfaRequired: boolean;
  mfaVerified: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAdmin: false,
  isLeadership: false,
  portalAccess: false,
  mfaRequired: false,
  mfaVerified: false,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const res = await api.me();
        return res;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const user = data?.user ?? null;
  const roles = user?.roles ?? (user ? [user.role] : []);
  const isAdmin = roles.some((role) => role === "super_admin" || role === "admin");
  const isLeadership = roles.some((role) => LEADERSHIP_ROLES.includes(role));

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin,
        isLeadership,
        portalAccess: data?.portalAccess ?? false,
        mfaRequired: data?.mfaRequired ?? false,
        mfaVerified: data?.mfaVerified ?? false,
        refresh: async () => {
          await queryClient.invalidateQueries({ queryKey: ["me"] });
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
