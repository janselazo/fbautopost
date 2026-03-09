import { prisma } from "../prisma";
import { refreshListing } from "./playwright/marketplace-poster";

export async function processPostingQueue(userId: string): Promise<void> {
  const config = await prisma.automationConfig.findUnique({ where: { userId } });
  if (!config?.enabled || !config.postingEnabled) return;

  const now = new Date();
  const currentHour = now.getHours();
  if (currentHour < config.postingStartHour || currentHour >= config.postingEndHour) {
    return; // outside posting hours
  }

  // Count posts already made today
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const postsToday = await prisma.postingTask.count({
    where: { userId, status: "posted", completedAt: { gte: todayStart } },
  });

  const remaining = config.postsPerDay - postsToday;
  if (remaining <= 0) return;

  // Check for queued tasks already waiting
  const pendingCount = await prisma.postingTask.count({
    where: { userId, status: { in: ["queued", "posting"] } },
  });
  if (pendingCount >= 3) return; // don't overload the queue

  // Find vehicles that need posting (prioritize those never posted or posted longest ago)
  const recentlyPostedVehicleIds = (
    await prisma.postingTask.findMany({
      where: { userId, status: "posted", completedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
      select: { vehicleId: true },
      distinct: ["vehicleId"],
    })
  ).map((t) => t.vehicleId);

  const candidates = await prisma.vehicle.findMany({
    where: {
      userId,
      status: "Available",
      id: { notIn: recentlyPostedVehicleIds.length > 0 ? recentlyPostedVehicleIds : undefined },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(remaining, 3),
  });

  // If no unposted vehicles, pick the oldest-posted for rotation (refresh)
  let vehiclesToPost = candidates;
  let isRotation = false;
  if (vehiclesToPost.length === 0) {
    const oldestPosted = await prisma.postingTask.findMany({
      where: { userId, status: "posted" },
      orderBy: { completedAt: "asc" },
      take: Math.min(remaining, 3),
      distinct: ["vehicleId"],
    });

    if (oldestPosted.length > 0) {
      vehiclesToPost = await prisma.vehicle.findMany({
        where: {
          id: { in: oldestPosted.map((t) => t.vehicleId) },
          status: "Available",
        },
      });
      isRotation = true;
    }
  }

  if (vehiclesToPost.length === 0) return;

  for (const vehicle of vehiclesToPost) {
    if (isRotation) {
      // For rotation: delete old listing first, then repost as fresh
      const session = await prisma.browserSession.findUnique({ where: { userId } });
      if (session?.valid) {
        await refreshListing(userId, vehicle.id).catch((e) =>
          console.error(`[PostingQueue] Refresh failed for vehicle ${vehicle.id}:`, e)
        );
      }
    } else {
      // New post: queue normally
      const photoUrls = parsePhotoUrls(vehicle.description);
      const listingText = generateListingText(vehicle);

      const hoursRemaining = config.postingEndHour - currentHour;
      const randomMinutes = Math.floor(Math.random() * Math.min(hoursRemaining * 60, 60));
      const scheduledFor = new Date(now.getTime() + randomMinutes * 60_000);

      await prisma.postingTask.create({
        data: {
          userId,
          vehicleId: vehicle.id,
          status: "queued",
          taskType: "new",
          listingText,
          photoUrls: JSON.stringify(photoUrls),
          scheduledFor,
        },
      });

      console.log(
        `[PostingQueue] Queued ${vehicle.year} ${vehicle.make} ${vehicle.model} for ${scheduledFor.toLocaleTimeString()}`
      );
    }
  }
}

function parsePhotoUrls(description: string | null): string[] {
  if (!description) return [];
  try {
    const parsed = JSON.parse(description);
    if (Array.isArray(parsed)) return parsed.filter((u: unknown) => typeof u === "string");
  } catch {
    // description is not JSON photo array
  }
  return [];
}

function generateListingText(vehicle: {
  year: number;
  make: string;
  model: string;
  trim: string;
  price: number;
  mileage: number;
  color: string;
  vin: string;
}): string {
  const lines = [
    `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`,
    "",
  ];

  if (vehicle.mileage > 0)
    lines.push(`Mileage: ${vehicle.mileage.toLocaleString()} miles`);
  if (vehicle.color) lines.push(`Exterior: ${vehicle.color}`);
  if (vehicle.price > 0) lines.push(`Price: $${vehicle.price.toLocaleString()}`);
  if (vehicle.vin) lines.push(`VIN: ${vehicle.vin}`);

  lines.push("", "Message us to schedule a test drive!");

  return lines.join("\n");
}

/** Generate an AI-optimized listing description using OpenAI (optional enhancement) */
export async function generateAIListing(vehicle: {
  year: number;
  make: string;
  model: string;
  trim: string;
  price: number;
  mileage: number;
  color: string;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Write a compelling Facebook Marketplace vehicle listing description. Keep it under 150 words. Be professional but warm. Include key specs. End with a call to action to schedule a test drive. Do not use excessive emojis or all-caps.",
          },
          {
            role: "user",
            content: `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}\nPrice: $${vehicle.price.toLocaleString()}\nMileage: ${vehicle.mileage.toLocaleString()} miles\nColor: ${vehicle.color}`,
          },
        ],
        max_tokens: 250,
        temperature: 0.7,
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}
