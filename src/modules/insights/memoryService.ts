import { prisma } from "@/lib/db";

export type MemoryCategory = "preference" | "fact" | "whatHelped" | "trigger";

export interface UserMemory {
  id: string;
  category: MemoryCategory;
  content: string;
  createdAt: Date;
}

export async function storeMemory(
  userId: string,
  category: MemoryCategory,
  content: string,
  source: "chat" | "checkin" | "explicit"
): Promise<void> {
  const existing = await prisma.insight_UserMemory.findFirst({
    where: {
      userId,
      category,
      content: { contains: content.slice(0, 50), mode: "insensitive" },
    },
  });

  if (existing) {
    await prisma.insight_UserMemory.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
  } else {
    await prisma.insight_UserMemory.create({
      data: {
        userId,
        category,
        content,
        source,
      },
    });
  }
}

export async function getMemoriesForUser(
  userId: string,
  limit: number = 10
): Promise<UserMemory[]> {
  const memories = await prisma.insight_UserMemory.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return memories.map((m) => ({
    id: m.id,
    category: m.category as MemoryCategory,
    content: m.content,
    createdAt: m.createdAt,
  }));
}

export async function getMemoriesByCategory(
  userId: string,
  category: MemoryCategory,
  limit: number = 5
): Promise<string[]> {
  const memories = await prisma.insight_UserMemory.findMany({
    where: { userId, category },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { content: true },
  });

  return memories.map((m) => m.content);
}

export function formatMemoriesForContext(memories: UserMemory[]): string {
  if (memories.length === 0) return "No stored memories yet";

  const byCategory: Record<string, string[]> = {
    preference: [],
    fact: [],
    whatHelped: [],
    trigger: [],
  };

  for (const m of memories) {
    byCategory[m.category]?.push(m.content);
  }

  const parts: string[] = [];

  if (byCategory.preference.length > 0) {
    parts.push(`Preferences: ${byCategory.preference.join("; ")}`);
  }
  if (byCategory.fact.length > 0) {
    parts.push(`Facts about them: ${byCategory.fact.join("; ")}`);
  }
  if (byCategory.whatHelped.length > 0) {
    parts.push(`What helped before: ${byCategory.whatHelped.join("; ")}`);
  }
  if (byCategory.trigger.length > 0) {
    parts.push(`Sensitive topics: ${byCategory.trigger.join("; ")}`);
  }

  return parts.join("\n");
}

const MEMORY_PATTERNS = {
  whatHelped: [
    /(?:helped|worked|felt better|calmed|eased)/i,
    /(?:ice|heating pad|walking|bath|breathing|music|partner|friend)/i,
  ],
  preference: [
    /(?:i prefer|i like|i don't like|i hate|i love|i usually)/i,
  ],
  fact: [
    /(?:i am|i'm a|i have|i work|my partner|my husband|my wife|my job)/i,
    /(?:this is my \w+ cycle|first time|done this before|previous cycle)/i,
  ],
  trigger: [
    /(?:hard to|struggle with|triggers me|can't handle|hate hearing)/i,
  ],
};

export function detectMemoryCategory(message: string): MemoryCategory | null {
  for (const [category, patterns] of Object.entries(MEMORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return category as MemoryCategory;
      }
    }
  }
  return null;
}

export function extractMemoryContent(message: string, category: MemoryCategory): string | null {
  const trimmed = message.trim();
  if (trimmed.length < 10 || trimmed.length > 500) return null;
  
  const sentences = trimmed.split(/[.!?]+/).filter(Boolean);
  for (const sentence of sentences) {
    for (const pattern of MEMORY_PATTERNS[category]) {
      if (pattern.test(sentence)) {
        return sentence.trim().slice(0, 200);
      }
    }
  }
  
  return null;
}

export async function processMessageForMemories(
  userId: string,
  message: string
): Promise<void> {
  const category = detectMemoryCategory(message);
  if (!category) return;

  const content = extractMemoryContent(message, category);
  if (!content) return;

  await storeMemory(userId, category, content, "chat");
}
