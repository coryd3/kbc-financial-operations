import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LEADERSHIP_ROLES, type SafeUser } from "@shared/schema";
import { api, ApiError } from "./api";

interface AuthContextValue {
  user: SafeUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  isLeadership: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAdmin: false,
  isLeadership: false,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const res = await api.me();
        return res.user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const user = data ?? null;
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const isLeadership = !!user && LEADERSHIP_ROLES.includes(user.role);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin,
        isLeadership,
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
