import { createContext, useContext, type PropsWithChildren } from "react";
import { Polar } from "@polar-sh/sdk";
import { useSession } from "./SessionProvider";

const PolarClientContext = createContext<{
  polar: Polar;
}>({
  polar: new Polar(),
});

export function usePolarClient() {
  const value = useContext(PolarClientContext);
  if (process.env.NODE_ENV !== "production") {
    if (!value) {
      throw new Error(
        "usePolarClient must be wrapped in a <PolarClientProvider />"
      );
    }
  }
  return value;
}

export function PolarClientProvider({ children }: PropsWithChildren) {
  const { session } = useSession();

  const polar = new Polar({
    accessToken: session ?? "",
  });

  return (
    <PolarClientContext.Provider
      value={{
        polar,
      }}
    >
      {children}
    </PolarClientContext.Provider>
  );
}
