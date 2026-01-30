import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      dbId?: string; // Our users table ID
    };
  }

  interface User {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    dbId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    dbId?: string;
  }
}
