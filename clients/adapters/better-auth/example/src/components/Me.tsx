"use client";

import { useSession } from "@/lib/auth-client";

export const Me = () => {
  const { data: session } = useSession();

  if (!session) {
    return <div>Not authenticated</div>;
  }

  return (
    <div>
      <h1>Welcome {session.user.name}</h1>
    </div>
  );
};
