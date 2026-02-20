import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  
  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

export async function getActiveCycle(userId: string) {
  return prisma.cycle.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: {
      protocol: {
        include: {
          medications: true,
          appointments: true,
          milestones: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
