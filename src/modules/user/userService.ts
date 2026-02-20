import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";
import type { ProfileUpdate } from "@/lib/validate";

export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { email },
  });
}

export async function getUserByPhone(phoneE164: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { phoneE164 },
  });
}

export async function updateUserProfile(
  userId: string,
  data: ProfileUpdate
): Promise<User> {
  const updateData: any = {};
  
  if (data.timezone !== undefined) {
    updateData.timezone = data.timezone;
  }
  if (data.phoneE164 !== undefined) {
    updateData.phoneE164 = data.phoneE164;
  }
  if (data.smsConsent !== undefined) {
    updateData.smsConsent = data.smsConsent;
  }
  if (data.quietHours !== undefined) {
    updateData.quietHours = data.quietHours === null 
      ? { set: null } 
      : data.quietHours;
  }

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
}

export async function updateSmsConsent(
  userId: string,
  smsConsent: boolean
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { smsConsent },
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.messageLog.deleteMany({ where: { userId } }),
    prisma.conversationState.deleteMany({ where: { userId } }),
    prisma.checkIn.deleteMany({ where: { userId } }),
    prisma.task.deleteMany({ where: { cycle: { userId } } }),
    prisma.planDay.deleteMany({ where: { cycle: { userId } } }),
    prisma.milestone.deleteMany({ where: { protocolPlan: { cycle: { userId } } } }),
    prisma.medication.deleteMany({ where: { protocolPlan: { cycle: { userId } } } }),
    prisma.protocolPlan.deleteMany({ where: { cycle: { userId } } }),
    prisma.upload.deleteMany({ where: { userId } }),
    prisma.cycle.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}

export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneE164: true, smsConsent: true },
  });

  if (!user) return false;
  
  return user.phoneE164 !== null && user.smsConsent === true;
}

export async function hasActiveProtocol(userId: string): Promise<boolean> {
  const cycle = await prisma.cycle.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      protocol: {
        status: "ACTIVE",
      },
    },
  });

  return cycle !== null;
}
