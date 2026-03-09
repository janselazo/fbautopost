import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { getSupabaseUserId } from "../supabase-auth";

const vehicleRouter = new Hono();

const createVehicleSchema = z.object({
  year: z.number().min(1900).max(2030),
  make: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().min(1),
  price: z.number().min(0),
  mileage: z.number().min(0),
  color: z.string().min(1),
  vin: z.string().min(1),
  condition: z.enum(["Excellent", "Good", "Fair"]),
  bodyType: z.enum(["Sedan", "SUV", "Truck", "Coupe", "Van", "Convertible"]),
  status: z.enum(["Available", "Sold", "Pending"]).optional().default("Available"),
  description: z.string().optional(),
  photoUrl: z.string().optional().nullable(),
});

const updateVehicleSchema = createVehicleSchema.partial();

// Use Supabase user id if available, otherwise fall back to "default" (single-user mode)
function getUserId(c: { get: (key: string) => unknown }): string {
  return getSupabaseUserId(c);
}

// Get all vehicles for the current user
vehicleRouter.get("/", async (c) => {
  const userId = getUserId(c);

  const vehicles = await prisma.vehicle.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: vehicles });
});

// Get a single vehicle
vehicleRouter.get("/:id", async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param("id"));

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, userId },
  });

  if (!vehicle) {
    return c.json({ error: { message: "Vehicle not found" } }, 404);
  }

  return c.json({ data: vehicle });
});

// Create a new vehicle
vehicleRouter.post("/", zValidator("json", createVehicleSchema), async (c) => {
  const userId = getUserId(c);
  const data = c.req.valid("json");

  // Ensure the user row exists (Supabase users aren't in our DB until first action)
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email: `${userId}@auto.local`, name: userId, createdAt: new Date(), updatedAt: new Date() },
    update: {},
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      ...data,
      userId,
    },
  });

  return c.json({ data: vehicle }, 201);
});

// Update a vehicle
vehicleRouter.put("/:id", zValidator("json", updateVehicleSchema), async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param("id"));
  const data = c.req.valid("json");

  const existing = await prisma.vehicle.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return c.json({ error: { message: "Vehicle not found" } }, 404);
  }

  const vehicle = await prisma.vehicle.update({
    where: { id },
    data,
  });

  return c.json({ data: vehicle });
});

// PATCH /api/vehicles/mark-sold — mark a vehicle as sold by VIN (or create if not in DB)
vehicleRouter.patch(
  "/mark-sold",
  zValidator(
    "json",
    z.object({
      vin: z.string().min(1),
      year: z.number().optional(),
      make: z.string().optional(),
      model: z.string().optional(),
      trim: z.string().optional(),
      price: z.number().optional(),
      mileage: z.number().optional(),
      color: z.string().optional(),
      bodyType: z.string().optional(),
      photoUrl: z.string().nullable().optional(),
    })
  ),
  async (c) => {
    const userId = getUserId(c);
    const data = c.req.valid("json");

    // Find existing vehicle by VIN
    const existing = await prisma.vehicle.findFirst({
      where: { userId, vin: data.vin },
    });

    if (existing) {
      const vehicle = await prisma.vehicle.update({
        where: { id: existing.id },
        data: { status: "Sold" },
      });
      return c.json({ data: vehicle });
    }

    // Vehicle not in DB yet — create it as Sold
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email: `${userId}@auto.local`, name: userId, createdAt: new Date(), updatedAt: new Date() },
      update: {},
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        userId,
        year: data.year || new Date().getFullYear(),
        make: data.make || "Unknown",
        model: data.model || "Unknown",
        trim: data.trim || "Base",
        price: data.price || 0,
        mileage: data.mileage || 0,
        color: data.color || "Unknown",
        vin: data.vin,
        condition: "Good",
        bodyType: data.bodyType || "SUV",
        status: "Sold",
        photoUrl: data.photoUrl || null,
      },
    });

    return c.json({ data: vehicle }, 201);
  }
);

// Delete a vehicle
vehicleRouter.delete("/:id", async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param("id"));

  const existing = await prisma.vehicle.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return c.json({ error: { message: "Vehicle not found" } }, 404);
  }

  await prisma.vehicle.delete({ where: { id } });

  return c.body(null, 204);
});

export { vehicleRouter };
