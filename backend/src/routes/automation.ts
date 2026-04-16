import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { getSupabaseUserId } from "../supabase-auth";

export const automationRouter = new Hono();

function getUserId(c: { get: (key: string) => unknown }): string {
  return getSupabaseUserId(c);
}

// GET /api/automation/config
automationRouter.get("/config", async (c) => {
  const userId = getUserId(c);
  const config = await prisma.automationConfig.findUnique({ where: { userId } });
  return c.json({ data: config });
});

// PUT /api/automation/config
automationRouter.put(
  "/config",
  zValidator(
    "json",
    z.object({
      enabled: z.boolean().optional(),
      postingEnabled: z.boolean().optional(),
      replyEnabled: z.boolean().optional(),
      postsPerDay: z.number().min(1).max(30).optional(),
      postingStartHour: z.number().min(0).max(23).optional(),
      postingEndHour: z.number().min(0).max(23).optional(),
      replyTone: z.enum(["friendly", "professional", "casual"]).optional(),
      replyHoursOnly: z.boolean().optional(),
      geoZipCodes: z.string().nullable().optional(),
      inventorySyncMins: z.number().min(30).max(1440).optional(),
      dealerWebsite: z.string().nullable().optional(),
    })
  ),
  async (c) => {
    const userId = getUserId(c);
    const data = c.req.valid("json");

    const config = await prisma.automationConfig.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return c.json({ data: config });
  }
);

// GET /api/automation/status — live automation status + stats
automationRouter.get("/status", async (c) => {
  const userId = getUserId(c);

  const config = await prisma.automationConfig.findUnique({ where: { userId } });
  const browserSession = await prisma.browserSession.findUnique({ where: { userId } });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalVehicles,
    postsToday,
    postsThirtyDays,
    messagesThirtyDays,
    appointmentsThirtyDays,
    pendingTasks,
    failedTasks,
  ] = await Promise.all([
    prisma.vehicle.count({ where: { userId, status: "Available" } }),
    prisma.postingTask.count({
      where: { userId, status: "posted", completedAt: { gte: todayStart } },
    }),
    prisma.postingTask.count({
      where: { userId, status: "posted", completedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.message.count({
      where: {
        conversation: { userId },
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.appointment.count({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.postingTask.count({ where: { userId, status: "queued" } }),
    prisma.postingTask.count({ where: { userId, status: "failed" } }),
  ]);

  return c.json({
    data: {
      automation: {
        enabled: config?.enabled ?? false,
        postingEnabled: config?.postingEnabled ?? false,
        replyEnabled: config?.replyEnabled ?? false,
      },
      facebook: {
        connected: browserSession?.valid ?? false,
        lastUsedAt: browserSession?.lastUsedAt ?? null,
      },
      stats: {
        totalVehicles,
        postsToday,
        postsThirtyDays,
        messagesThirtyDays,
        appointmentsThirtyDays,
        pendingTasks,
        failedTasks,
      },
    },
  });
});

// GET /api/automation/activity — recent activity feed
automationRouter.get("/activity", async (c) => {
  const userId = getUserId(c);
  const limit = Math.min(Number(c.req.query("limit") ?? "20"), 50);

  const [recentPosts, recentConversations, recentAppointments] = await Promise.all([
    prisma.postingTask.findMany({
      where: { userId, status: { in: ["posted", "failed"] } },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { vehicle: true } as never,
    }).catch(() => []),
    prisma.conversation.findMany({
      where: { userId },
      orderBy: { lastMessageAt: "desc" },
      take: limit,
    }),
    prisma.appointment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  type ActivityItem = {
    type: string;
    id: string;
    title: string;
    subtitle: string;
    status: string;
    timestamp: string;
  };

  const activities: ActivityItem[] = [
    ...recentPosts.map((p: { id: string; status: string; updatedAt: Date; listingText?: string | null }) => ({
      type: "post" as const,
      id: p.id,
      title: "Listing posted",
      subtitle: p.listingText?.slice(0, 60) || "Vehicle listing",
      status: p.status,
      timestamp: p.updatedAt.toISOString(),
    })),
    ...recentConversations.map((conv) => ({
      type: "message" as const,
      id: conv.id,
      title: conv.buyerName,
      subtitle: conv.vehicle,
      status: conv.status,
      timestamp: conv.lastMessageAt.toISOString(),
    })),
    ...recentAppointments.map((appt) => ({
      type: "appointment" as const,
      id: appt.id,
      title: appt.buyerName,
      subtitle: appt.vehicle,
      status: appt.status,
      timestamp: appt.createdAt.toISOString(),
    })),
  ];

  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return c.json({ data: activities.slice(0, limit) });
});

// GET /api/automation/listings — per-vehicle listing analytics
automationRouter.get("/listings", async (c) => {
  const userId = getUserId(c);
  const status = c.req.query("status") || "all";
  const limit = Math.min(Number(c.req.query("limit") ?? "50"), 100);
  const offset = Number(c.req.query("offset") ?? "0");

  // "sold" is a special filter — query vehicles with status "Sold" and join posting data
  if (status === "sold") {
    const soldVehicles = await prisma.vehicle.findMany({
      where: { userId, status: "Sold" },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    });

    const soldVehicleIds = soldVehicles.map((v) => v.id);
    const tasks = soldVehicleIds.length
      ? await prisma.postingTask.findMany({
          where: { userId, vehicleId: { in: soldVehicleIds } },
          orderBy: { updatedAt: "desc" },
        })
      : [];
    const tasksByVehicle = new Map<number, typeof tasks>();
    for (const t of tasks) {
      if (!tasksByVehicle.has(t.vehicleId)) tasksByVehicle.set(t.vehicleId, []);
      tasksByVehicle.get(t.vehicleId)!.push(t);
    }

    const conversationCounts = await prisma.conversation.groupBy({
      by: ["vehicle"],
      where: { userId },
      _count: { id: true },
    });
    const convCountMap = new Map(
      conversationCounts.map((cc) => [cc.vehicle.toLowerCase(), cc._count.id])
    );

    const enriched = soldVehicles.map((vehicle) => {
      const vehicleTasks = tasksByVehicle.get(vehicle.id) || [];
      const latestTask = vehicleTasks[0];
      const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`;
      const messagesForVehicle = convCountMap.get(vehicleName.toLowerCase()) ?? 0;

      return {
        id: latestTask?.id ?? `sold-${vehicle.id}`,
        vehicleId: vehicle.id,
        vehicleName,
        vehicleVin: vehicle.vin,
        vehiclePrice: vehicle.price,
        vehiclePhotoUrl: vehicle.photoUrl ?? null,
        vehicleStatus: "Sold",
        taskType: latestTask?.taskType ?? "—",
        status: "sold",
        fbListingUrl: latestTask?.fbListingUrl ?? null,
        listingText: latestTask?.listingText?.slice(0, 120) ?? null,
        messagesReceived: (latestTask?.messagesReceived ?? 0) + messagesForVehicle,
        attempts: latestTask?.attempts ?? 0,
        scheduledFor: null,
        completedAt: latestTask?.completedAt?.toISOString() ?? null,
        deletedAt: latestTask?.deletedAt?.toISOString() ?? null,
        createdAt: vehicle.createdAt.toISOString(),
        error: null,
        soldAt: vehicle.updatedAt.toISOString(),
        totalPosts: vehicleTasks.length,
      };
    });

    const total = await prisma.vehicle.count({ where: { userId, status: "Sold" } });
    return c.json({ data: { listings: enriched, total, limit, offset } });
  }

  const statusFilter =
    status === "all"
      ? { in: ["posted", "deleted", "failed", "queued", "posting"] as string[] }
      : status;

  const tasks = await prisma.postingTask.findMany({
    where: { userId, status: typeof statusFilter === "string" ? statusFilter : { in: statusFilter.in } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
  });

  // Enrich with vehicle data
  const vehicleIds = [...new Set(tasks.map((t) => t.vehicleId))];
  const vehicles = await prisma.vehicle.findMany({
    where: { id: { in: vehicleIds } },
  });
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

  // Count conversations per vehicle (messages from FB about specific vehicles)
  const conversationCounts = await prisma.conversation.groupBy({
    by: ["vehicle"],
    where: { userId },
    _count: { id: true },
  });
  const convCountMap = new Map(
    conversationCounts.map((cc) => [cc.vehicle.toLowerCase(), cc._count.id])
  );

  const enriched = tasks.map((task) => {
    const vehicle = vehicleMap.get(task.vehicleId);
    const vehicleName = vehicle
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`
      : "Unknown";
    const matchKey = vehicleName.toLowerCase();
    const messagesForVehicle = convCountMap.get(matchKey) ?? 0;

    return {
      id: task.id,
      vehicleId: task.vehicleId,
      vehicleName,
      vehicleVin: vehicle?.vin ?? "",
      vehiclePrice: vehicle?.price ?? 0,
      vehiclePhotoUrl: vehicle?.photoUrl ?? null,
      vehicleStatus: vehicle?.status ?? "Unknown",
      taskType: task.taskType,
      status: task.status,
      fbListingUrl: task.fbListingUrl,
      listingText: task.listingText?.slice(0, 120),
      messagesReceived: task.messagesReceived + messagesForVehicle,
      attempts: task.attempts,
      scheduledFor: task.scheduledFor?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      deletedAt: task.deletedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      error: task.error,
    };
  });

  const total = await prisma.postingTask.count({
    where: { userId, status: typeof statusFilter === "string" ? statusFilter : { in: statusFilter.in } },
  });

  return c.json({ data: { listings: enriched, total, limit, offset } });
});

// GET /api/automation/listings/:id — single listing detail
automationRouter.get("/listings/:id", async (c) => {
  const userId = getUserId(c);
  const task = await prisma.postingTask.findFirst({
    where: { id: c.req.param("id"), userId },
  });
  if (!task) return c.json({ error: { message: "Not found" } }, 404);

  const vehicle = await prisma.vehicle.findUnique({ where: { id: task.vehicleId } });

  // Get all posting history for this vehicle
  const history = await prisma.postingTask.findMany({
    where: { userId, vehicleId: task.vehicleId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Get conversations mentioning this vehicle
  const vehicleName = vehicle
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
    : "";
  const conversations = vehicleName
    ? await prisma.conversation.findMany({
        where: { userId, vehicle: { contains: vehicleName } },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
        orderBy: { lastMessageAt: "desc" },
        take: 10,
      })
    : [];

  return c.json({
    data: {
      task,
      vehicle,
      history: history.map((h) => ({
        id: h.id,
        taskType: h.taskType,
        status: h.status,
        completedAt: h.completedAt?.toISOString(),
        deletedAt: h.deletedAt?.toISOString(),
        createdAt: h.createdAt.toISOString(),
        fbListingUrl: h.fbListingUrl,
      })),
      conversations: conversations.map((conv) => ({
        id: conv.id,
        buyerName: conv.buyerName,
        lastMessage: conv.messages[0]?.body?.slice(0, 80),
        intentScore: conv.intentScore,
        status: conv.status,
        lastMessageAt: conv.lastMessageAt.toISOString(),
      })),
    },
  });
});

// GET /api/automation/dashboard — aggregated data for charts & pipeline
automationRouter.get("/dashboard", async (c) => {
  const userId = getUserId(c);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // --- Daily posting chart (last 7 days) ---
  const recentPosts = await prisma.postingTask.findMany({
    where: { userId, status: "posted", completedAt: { gte: sevenDaysAgo } },
    select: { completedAt: true },
  });

  const dailyPosts: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyPosts[d.toISOString().slice(0, 10)] = 0;
  }
  for (const p of recentPosts) {
    if (p.completedAt) {
      const key = p.completedAt.toISOString().slice(0, 10);
      if (key in dailyPosts) dailyPosts[key]!++;
    }
  }
  const postingChart = Object.entries(dailyPosts).map(([date, count]) => ({
    date,
    label: new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }),
    count,
  }));

  // --- Daily messages chart (last 7 days) ---
  const recentMessages = await prisma.message.findMany({
    where: { conversation: { userId }, direction: "incoming", createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true },
  });

  const dailyMessages: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyMessages[d.toISOString().slice(0, 10)] = 0;
  }
  for (const m of recentMessages) {
    const key = m.createdAt.toISOString().slice(0, 10);
    if (key in dailyMessages) dailyMessages[key]!++;
  }
  const messagesChart = Object.entries(dailyMessages).map(([date, count]) => ({
    date,
    label: new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }),
    count,
  }));

  // --- Lead pipeline funnel ---
  const leadCounts = await prisma.lead.groupBy({
    by: ["tag"],
    where: { userId },
    _count: { id: true },
  });
  const conversationCounts = await prisma.conversation.groupBy({
    by: ["crmStatus"],
    where: { userId },
    _count: { id: true },
  });

  const pipeline: Record<string, number> = {
    new: 0,
    contacted: 0,
    appointment: 0,
    hot: 0,
    warm: 0,
    cold: 0,
    converted: 0,
    lost: 0,
  };

  for (const lc of leadCounts) {
    const tag = lc.tag.toLowerCase();
    if (tag in pipeline) pipeline[tag]! += lc._count.id;
  }
  for (const cc of conversationCounts) {
    const status = cc.crmStatus.toLowerCase().replace("_lead", "").replace("new_", "new");
    if (status === "new_lead" || status === "new") pipeline["new"]! += cc._count.id;
    else if (status === "contacted") pipeline["contacted"]! += cc._count.id;
    else if (status === "appointment_set" || status === "appointment") pipeline["appointment"]! += cc._count.id;
    else if (status in pipeline) pipeline[status]! += cc._count.id;
  }

  // --- Totals for big stat cards ---
  const [
    totalPosted,
    totalVehicles,
    soldVehicles,
    newMessagesLast7d,
    appointmentCount,
    totalLeads,
  ] = await Promise.all([
    prisma.postingTask.count({ where: { userId, status: "posted" } }),
    prisma.vehicle.count({ where: { userId, status: "Available" } }),
    prisma.vehicle.count({ where: { userId, status: "Sold" } }),
    prisma.message.count({
      where: { conversation: { userId }, direction: "incoming", createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.appointment.count({ where: { userId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.lead.count({ where: { userId } }),
  ]);

  return c.json({
    data: {
      postingChart,
      messagesChart,
      pipeline,
      totals: {
        totalPosted,
        totalVehicles,
        soldVehicles,
        newMessagesLast7d,
        appointmentCount,
        totalLeads,
      },
    },
  });
});

// POST /api/automation/toggle — quick enable/disable
automationRouter.post(
  "/toggle",
  zValidator("json", z.object({ enabled: z.boolean() })),
  async (c) => {
    const userId = getUserId(c);
    const { enabled } = c.req.valid("json");

    const config = await prisma.automationConfig.upsert({
      where: { userId },
      create: { userId, enabled },
      update: { enabled },
    });

    return c.json({ data: config });
  }
);
