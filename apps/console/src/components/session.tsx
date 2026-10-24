import React from "react";
import { fetchAutonomiaSession } from "../lib/autonomia/api/autonomiaAuthApi";
import type { AutonomiaConsoleUser } from "../lib/autonomia/types";

// 會話狀態:登入後的 user 由 context 共用;loading 期間由 ConsoleLayout 顯示 spinner。

interface SessionValue {
  user: AutonomiaConsoleUser | null;
  loading: boolean;
  setUser: (user: AutonomiaConsoleUser | null) => void;
  refresh: () => Promise<void>;
}

const SessionContext = React.createContext<SessionValue>({
  user: null,
  loading: true,
  setUser: () => {},
  refresh: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AutonomiaConsoleUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      setUser(await fetchAutonomiaSession());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = React.useMemo(() => ({ user, loading, setUser, refresh }), [user, loading, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return React.useContext(SessionContext);
}
