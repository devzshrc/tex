import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { navigate, useLocation } from "@/lib/router";
import { Landing } from "./pages/Landing";
import { SignIn } from "./pages/SignIn";
import "./index.css";

/**
 * Route switch (foundation milestone): public landing + sign-in only.
 * Signed-in visitors to /signin are sent onward (workspace lands next).
 */
export function App() {
  const { pathname } = useLocation();
  const { data: session, isPending } = useSession();
  const authed = !!session?.user;

  useEffect(() => {
    if (!isPending && pathname === "/signin" && authed) navigate("/o");
  }, [pathname, authed, isPending]);

  if (pathname === "/signin") return <SignIn />;
  return <Landing />;
}

export default App;
