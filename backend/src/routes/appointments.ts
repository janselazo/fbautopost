import { Hono } from "hono";
import { prisma } from "../prisma";
import { getSupabaseUserId } from "../supabase-auth";

export const appointmentsRouter = new Hono();

// GET /api/appointments — list all appointments for user
appointmentsRouter.get("/", async (c) => {
  const userId = getSupabaseUserId(c);
  const appointments = await prisma.appointment.findMany({
    where: { userId },
    orderBy: { scheduledAt: "asc" },
  });
  return c.json({ data: appointments });
});

// POST /api/appointments — create appointment
appointmentsRouter.post("/", async (c) => {
  const userId = getSupabaseUserId(c);
  const body = await c.req.json();
  const appt = await prisma.appointment.create({
    data: {
      userId,
      conversationId: body.conversationId ?? null,
      buyerName: body.buyerName,
      buyerPhone: body.buyerPhone ?? null,
      vehicle: body.vehicle,
      scheduledAt: new Date(body.scheduledAt),
      notes: body.notes ?? null,
      status: "scheduled",
    },
  });
  return c.json({ data: appt }, 201);
});

// PATCH /api/appointments/:id — update status or details
appointmentsRouter.patch("/:id", async (c) => {
  const userId = getSupabaseUserId(c);
  const id = c.req.param("id");
  const body = await c.req.json();
  const appt = await prisma.appointment.update({
    where: { id, userId },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.scheduledAt && { scheduledAt: new Date(body.scheduledAt) }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.buyerPhone !== undefined && { buyerPhone: body.buyerPhone }),
    },
  });
  return c.json({ data: appt });
});

// DELETE /api/appointments/:id
appointmentsRouter.delete("/:id", async (c) => {
  const userId = getSupabaseUserId(c);
  const id = c.req.param("id");
  await prisma.appointment.delete({ where: { id, userId } });
  return c.body(null, 204);
});
