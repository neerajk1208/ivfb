import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import { shouldHaveFreeAccess } from "@/config/freeAccess";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  
  callbacks: {
    async signIn({ user, account }) {
      console.log(`[Auth] signIn: email=${user.email}, provider=${account?.provider}`);
      
      if (!user.email) {
        console.log(`[Auth] signIn rejected: no email`);
        return false;
      }

      try {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!existingUser) {
          const freeAccess = shouldHaveFreeAccess(user.email);
          
          const newUser = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name,
              freeAccess,
            },
          });

          await prisma.cycle.create({
            data: {
              userId: newUser.id,
              status: "ACTIVE",
              startDate: new Date(),
            },
          });
        } else if (!existingUser.freeAccess && shouldHaveFreeAccess(user.email)) {
          // Grant free access to existing users if they're on the list
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { freeAccess: true },
          });
        }

        return true;
      } catch (error) {
        console.error("Error during sign in:", error);
        return false;
      }
    },

    async session({ session, token }) {
      const email = session.user?.email;
      console.log(`[Auth] session callback: email=${email}, tokenSub=${token.sub ? "yes" : "no"}`);
      
      if (session.user && token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: session.user.email! },
            select: { id: true, timezone: true, phoneE164: true, smsConsent: true },
          });
          
          if (dbUser) {
            (session.user as any).id = dbUser.id;
            (session.user as any).timezone = dbUser.timezone;
            (session.user as any).phoneE164 = dbUser.phoneE164;
            (session.user as any).smsConsent = dbUser.smsConsent;
            console.log(`[Auth] session: user found, id=${dbUser.id}`);
          } else {
            console.log(`[Auth] session: no user in DB for ${email}`);
          }
        } catch (err) {
          console.error(`[Auth] session error:`, err);
        }
      }
      return session;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },

  pages: {
    signIn: "/",
    error: "/",
  },

  session: {
    strategy: "jwt",
  },
};
