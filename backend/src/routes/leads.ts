import { Hono } from "hono";
import { prisma } from "../prisma";
import { getSupabaseUserId } from "../supabase-auth";

export const leadsRouter = new Hono();

// Use Supabase user id if available, otherwise fall back to "default" (single-user mode)
function getUserId(c: { get: (key: string) => unknown }): string {
  return getSupabaseUserId(c);
}

// GET /api/leads — list all leads for the authenticated user
leadsRouter.get("/", async (c) => {
  const userId = getUserId(c);

  const leads = await prisma.lead.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: leads });
});

// POST /api/leads — create a new lead
leadsRouter.post("/", async (c) => {
  const userId = getUserId(c);

  const body = await c.req.json<{ name: string; email?: string; phone?: string; vehicle?: string; tag?: string; notes?: string; sourceConversationId?: string }>();

  if (!body.name?.trim()) {
    return c.json({ error: { message: "name is required", code: "MISSING_NAME" } }, 400);
  }

  // Avoid duplicates: check if a lead with same name+vehicle already exists for this user
  if (body.sourceConversationId) {
    const existing = await prisma.lead.findFirst({
      where: { userId, notes: { contains: body.sourceConversationId } },
    });
    if (existing) return c.json({ data: existing }, 200);
  }

  const lead = await prisma.lead.create({
    data: {
      userId,
      name: body.name.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      vehicle: body.vehicle?.trim() || null,
      tag: body.tag || "new",
      notes: body.notes?.trim() || null,
    },
  });

  return c.json({ data: lead }, 201);
});

// PATCH /api/leads/:id — update a lead
leadsRouter.patch("/:id", async (c) => {
  const userId = getUserId(c);

  const id = c.req.param("id");
  const existing = await prisma.lead.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: { message: "Lead not found", code: "NOT_FOUND" } }, 404);

  const body = await c.req.json<{ name?: string; email?: string; phone?: string; vehicle?: string; tag?: string; notes?: string }>();

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name?.trim() }),
      ...(body.email !== undefined && { email: body.email?.trim() || null }),
      ...(body.phone !== undefined && { phone: body.phone?.trim() || null }),
      ...(body.vehicle !== undefined && { vehicle: body.vehicle?.trim() || null }),
      ...(body.tag !== undefined && { tag: body.tag }),
      ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
    },
  });

  return c.json({ data: lead });
});

// DELETE /api/leads/:id — delete a lead
leadsRouter.delete("/:id", async (c) => {
  const userId = getUserId(c);

  const id = c.req.param("id");
  const existing = await prisma.lead.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: { message: "Lead not found", code: "NOT_FOUND" } }, 404);

  await prisma.lead.delete({ where: { id } });
  return c.body(null, 204);
});
