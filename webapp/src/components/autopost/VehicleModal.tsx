import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  Vehicle,
  VehicleStatus,
  VehicleCondition,
  VehicleBodyType,
} from './types';

interface VehicleModalProps {
  open: boolean;
  onClose: () => void;
  vehicle?: Vehicle | null;
  onSave: (vehicle: Omit<Vehicle, 'id'> & { id?: number }) => void;
}

const emptyForm = {
  year: new Date().getFullYear(),
  make: '',
  model: '',
  trim: '',
  price: 0,
  mileage: 0,
  color: '',
  vin: '',
  condition: 'Good' as VehicleCondition,
  bodyType: 'Sedan' as VehicleBodyType,
  status: 'Available' as VehicleStatus,
  description: '',
};

export function VehicleModal({ open, onClose, vehicle, onSave }: VehicleModalProps) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (vehicle) {
      setForm({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        price: vehicle.price,
        mileage: vehicle.mileage,
        color: vehicle.color,
        vin: vehicle.vin,
        condition: vehicle.condition,
        bodyType: vehicle.bodyType,
        status: vehicle.status,
        description: vehicle.description,
      });
    } else {
      setForm(emptyForm);
    }
  }, [vehicle, open]);

  const handleSave = () => {
    if (!form.make || !form.model) return;
    onSave({ ...form, id: vehicle?.id });
    onClose();
  };

  const field = (
    id: string,
    label: string,
    children: React.ReactNode
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="font-dm text-sm text-foreground">
        {label}
      </Label>
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto font-dm">
        <DialogHeader>
          <DialogTitle className="font-bebas text-2xl tracking-wider text-foreground">
            {vehicle ? 'EDIT VEHICLE' : 'ADD VEHICLE'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          {field(
            'year',
            'Year',
            <Input
              id="year"
              type="number"
              value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: parseInt(e.target.value) || 0 }))}
              className="bg-input border-border text-foreground"
            />
          )}
          {field(
            'make',
            'Make',
            <Input
              id="make"
              value={form.make}
              placeholder="Toyota"
              onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
              className="bg-input border-border text-foreground"
            />
          )}
          {field(
            'model',
            'Model',
            <Input
              id="model"
              value={form.model}
              placeholder="Camry"
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              className="bg-input border-border text-foreground"
            />
          )}
          {field(
            'trim',
            'Trim',
            <Input
              id="trim"
              value={form.trim}
              placeholder="XSE"
              onChange={(e) => setForm((f) => ({ ...f, trim: e.target.value }))}
              className="bg-input border-border text-foreground"
            />
          )}
          {field(
            'price',
            'Price ($)',
            <Input
              id="price"
              type="number"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: parseInt(e.target.value) || 0 }))}
              className="bg-input border-border text-foreground"
            />
          )}
          {field(
            'mileage',
            'Mileage',
            <Input
              id="mileage"
              type="number"
              value={form.mileage}
              onChange={(e) => setForm((f) => ({ ...f, mileage: parseInt(e.target.value) || 0 }))}
              className="bg-input border-border text-foreground"
            />
          )}
          {field(
            'color',
            'Color',
            <Input
              id="color"
              value={form.color}
              placeholder="Midnight Black"
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="bg-input border-border text-foreground"
            />
          )}
          {field(
            'vin',
            'VIN',
            <Input
              id="vin"
              value={form.vin}
              placeholder="4T1BF1FK5EU123456"
              onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))}
              className="bg-input border-border text-foreground"
            />
          )}
          {field(
            'condition',
            'Condition',
            <Select
              value={form.condition}
              onValueChange={(v) => setForm((f) => ({ ...f, condition: v as VehicleCondition }))}
            >
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {(['Excellent', 'Good', 'Fair'] as VehicleCondition[]).map((c) => (
                  <SelectItem key={c} value={c} className="text-foreground">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {field(
            'bodyType',
            'Body Type',
            <Select
              value={form.bodyType}
              onValueChange={(v) => setForm((f) => ({ ...f, bodyType: v as VehicleBodyType }))}
            >
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {(['Sedan', 'SUV', 'Truck', 'Coupe', 'Van', 'Convertible'] as VehicleBodyType[]).map((b) => (
                  <SelectItem key={b} value={b} className="text-foreground">{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {field(
            'status',
            'Status',
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v as VehicleStatus }))}
            >
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {(['Available', 'Pending', 'Sold'] as VehicleStatus[]).map((s) => (
                  <SelectItem key={s} value={s} className="text-foreground">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {field(
          'description',
          'Description',
          <Textarea
            id="description"
            value={form.description}
            placeholder="Brief vehicle description..."
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="bg-input border-border text-foreground min-h-[80px]"
          />
        )}

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose} className="border-border font-dm">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!form.make || !form.model}
            className="bg-primary text-primary-foreground font-dm font-medium hover:bg-primary/90"
          >
            {vehicle ? 'Save Changes' : 'Add Vehicle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
