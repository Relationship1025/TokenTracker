import { useInsforgeAuth } from "../../contexts/InsforgeAuthContext.jsx";

export function useAccountProfileSettings() {
  const auth = useInsforgeAuth() || {};
  const user = auth.user || {};
  return {
    ...auth,
    enabled: Boolean(auth.enabled),
    email: user.email || "",
    userId: typeof user.id === "string" ? user.id : "",
  };
}
