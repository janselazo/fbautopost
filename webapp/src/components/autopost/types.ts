export type VehicleStatus = 'Available' | 'Sold' | 'Pending';
export type VehicleCondition = 'Excellent' | 'Good' | 'Fair';
export type VehicleBodyType = 'Sedan' | 'SUV' | 'Truck' | 'Coupe' | 'Van' | 'Convertible';
export type PostTemplate = 'premium' | 'quicksale' | 'feature';
export type PriceDisplay = 'show' | 'call' | 'offer';
export type PostStatus = 'Posted' | 'Scheduled' | 'Draft';

// Marketplace platform types
export type MarketplacePlatform = 'facebook_marketplace' | 'facebook_groups' | 'craigslist';

export interface MarketplaceIntegration {
  platform: MarketplacePlatform;
  connected: boolean;
  accountName?: string;
  groups?: FacebookGroup[];
  region?: string; // For Craigslist
}

export interface FacebookGroup {
  id: string;
  name: string;
  memberCount?: number;
  selected: boolean;
}

export interface CraigslistRegion {
  id: string;
  name: string;
  url: string;
}
export type ActiveView =
  | 'dashboard'
  | 'composer'
  | 'history'
  | 'sold'
  | 'leads-list'
  | 'leads'
  | 'crm'
  | 'calendar'
  | 'analytics'
  | 'market-intelligence'
  | 'support'
  | 'settings'
  | 'connect-inventory';

export interface Vehicle {
  id: number;
  year: number;
  make: string;
  model: string;
  trim: string;
  price: number;
  mileage: number;
  color: string;
  vin: string;
  condition: VehicleCondition;
  bodyType: VehicleBodyType;
  status: VehicleStatus;
  description: string;
}

export interface PostHistoryItem {
  id: number;
  vehicleId: number;
  vehicleName: string;
  postedAt: string;
  template: PostTemplate;
  status: PostStatus;
  postText: string;
  scheduledFor?: string;
  platforms?: MarketplacePlatform[];
}

// Sample Facebook Groups for demo
export const sampleFacebookGroups: FacebookGroup[] = [
  { id: '1', name: 'Local Car Deals - Buy & Sell', memberCount: 45000, selected: true },
  { id: '2', name: 'Used Cars Under $40K', memberCount: 32000, selected: true },
  { id: '3', name: 'Truck & SUV Marketplace', memberCount: 28500, selected: false },
  { id: '4', name: 'Auto Enthusiasts Buy/Sell', memberCount: 18000, selected: false },
  { id: '5', name: 'Clean Title Cars Only', memberCount: 22000, selected: false },
];

// Popular Craigslist regions
export const craigslistRegions: CraigslistRegion[] = [
  { id: 'sfbay', name: 'San Francisco Bay Area', url: 'https://sfbay.craigslist.org' },
  { id: 'losangeles', name: 'Los Angeles', url: 'https://losangeles.craigslist.org' },
  { id: 'chicago', name: 'Chicago', url: 'https://chicago.craigslist.org' },
  { id: 'newyork', name: 'New York City', url: 'https://newyork.craigslist.org' },
  { id: 'houston', name: 'Houston', url: 'https://houston.craigslist.org' },
  { id: 'phoenix', name: 'Phoenix', url: 'https://phoenix.craigslist.org' },
  { id: 'dallas', name: 'Dallas / Fort Worth', url: 'https://dallas.craigslist.org' },
  { id: 'miami', name: 'Miami / South Florida', url: 'https://miami.craigslist.org' },
  { id: 'atlanta', name: 'Atlanta', url: 'https://atlanta.craigslist.org' },
  { id: 'seattle', name: 'Seattle', url: 'https://seattle.craigslist.org' },
];

export const sampleVehicles: Vehicle[] = [
  { id: 1, year: 2021, make: 'Toyota', model: 'Camry', trim: 'XSE', price: 27500, mileage: 28400, color: 'Midnight Black', vin: '4T1BF1FK5EU123456', condition: 'Excellent', bodyType: 'Sedan', status: 'Available', description: 'One owner, clean Carfax. Loaded with tech package.' },
  { id: 2, year: 2020, make: 'Ford', model: 'F-150', trim: 'XLT', price: 34900, mileage: 41200, color: 'Oxford White', vin: '1FTEW1EP4LKD89012', condition: 'Good', bodyType: 'Truck', status: 'Available', description: 'Crew cab, 4WD, tow package. Work-ready beast.' },
  { id: 3, year: 2022, make: 'Honda', model: 'CR-V', trim: 'EX-L', price: 31200, mileage: 15600, color: 'Sonic Gray Pearl', vin: '5J6RW2H80NA034567', condition: 'Excellent', bodyType: 'SUV', status: 'Available', description: 'Barely broken in. Leather seats, sunroof, Honda Sensing.' },
  { id: 4, year: 2019, make: 'Chevrolet', model: 'Silverado', trim: 'LTZ', price: 39500, mileage: 52100, color: 'Satin Steel Gray', vin: '3GCPWCED1KG234567', condition: 'Good', bodyType: 'Truck', status: 'Pending', description: 'Z71 package, heated/cooled seats, leather interior.' },
  { id: 5, year: 2023, make: 'BMW', model: '3 Series', trim: '330i', price: 44800, mileage: 8900, color: 'Alpine White', vin: 'WBA5R1C53GF345678', condition: 'Excellent', bodyType: 'Sedan', status: 'Available', description: 'Like new! M Sport package, 19" wheels, premium sound.' },
  { id: 6, year: 2020, make: 'Jeep', model: 'Grand Cherokee', trim: 'Laredo', price: 28900, mileage: 44800, color: 'Granite Crystal', vin: '1C4RJFAG1LC456789', condition: 'Good', bodyType: 'SUV', status: 'Available', description: 'Well maintained, great family SUV with 4WD capability.' },
  { id: 7, year: 2018, make: 'Tesla', model: 'Model 3', trim: 'Long Range', price: 32500, mileage: 61200, color: 'Deep Blue Metallic', vin: '5YJ3E1EA8JF567890', condition: 'Good', bodyType: 'Sedan', status: 'Available', description: 'Dual motor AWD. Recent tire rotation. Full self-driving hardware.' },
  { id: 8, year: 2021, make: 'RAM', model: '1500', trim: 'Big Horn', price: 41200, mileage: 33700, color: 'Flame Red', vin: '1C6SRFFT4MN678901', condition: 'Excellent', bodyType: 'Truck', status: 'Available', description: 'Night Edition package, 12" touchscreen, air suspension.' },
];

export const samplePostHistory: PostHistoryItem[] = [
  { id: 1, vehicleId: 7, vehicleName: '2018 Tesla Model 3 Long Range', postedAt: '2024-01-15T14:32:00Z', template: 'premium', status: 'Posted', postText: 'Check out this amazing 2018 Tesla Model 3...' },
  { id: 2, vehicleId: 4, vehicleName: '2019 Chevrolet Silverado LTZ', postedAt: '2024-01-18T10:15:00Z', template: 'quicksale', status: 'Posted', postText: 'PRICE DROP! 2019 Silverado LTZ going fast...' },
  { id: 3, vehicleId: 3, vehicleName: '2022 Honda CR-V EX-L', postedAt: '2024-01-20T09:00:00Z', template: 'feature', status: 'Scheduled', postText: 'Feature highlight: 2022 Honda CR-V EX-L...', scheduledFor: '2024-01-21T09:00:00Z' },
  { id: 4, vehicleId: 1, vehicleName: '2021 Toyota Camry XSE', postedAt: '2024-01-12T16:45:00Z', template: 'premium', status: 'Posted', postText: 'Premium listing: 2021 Toyota Camry XSE...' },
  { id: 5, vehicleId: 2, vehicleName: '2020 Ford F-150 XLT', postedAt: '2024-01-22T11:30:00Z', template: 'quicksale', status: 'Draft', postText: 'Draft: 2020 Ford F-150 XLT crew cab...' },
];

export function generatePostText(
  vehicle: Vehicle,
  template: PostTemplate,
  priceDisplay: PriceDisplay,
  hashtags: string[],
  customMessage?: string
): string {
  if (customMessage && customMessage.trim().length > 0) {
    return customMessage + '\n\n' + hashtags.map(h => '#' + h).join(' ');
  }

  const priceText =
    priceDisplay === 'show'
      ? `$${vehicle.price.toLocaleString()}`
      : priceDisplay === 'call'
      ? 'Call for Price'
      : 'Make an Offer';

  const mileageText = vehicle.mileage.toLocaleString();

  if (template === 'premium') {
    return `🚗 ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}

💰 Price: ${priceText}
📍 ${mileageText} miles
🎨 Color: ${vehicle.color}
✅ Condition: ${vehicle.condition}
🔑 Body: ${vehicle.bodyType}
🔢 VIN: ${vehicle.vin}

${vehicle.description}

This ${vehicle.condition.toLowerCase()} condition ${vehicle.bodyType.toLowerCase()} is ready for its next owner. Priced to sell — don't miss out!

📞 Message us or call for a test drive today!

${hashtags.map(h => '#' + h).join(' ')}`;
  }

  if (template === 'quicksale') {
    return `⚡ QUICK SALE — ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}

🔥 ${priceText} — SERIOUS INQUIRIES ONLY

${vehicle.mileage.toLocaleString()} miles | ${vehicle.color} | ${vehicle.condition} Condition

${vehicle.description}

This one won't last! We have buyers lined up — first come, first served.

✅ Clean title
✅ Ready to drive home today
✅ Financing available

DM NOW or call to secure your spot!

${hashtags.map(h => '#' + h).join(' ')}`;
  }

  // feature template
  const feature =
    vehicle.condition === 'Excellent'
      ? `pristine ${vehicle.condition.toLowerCase()} condition`
      : `well-maintained ${vehicle.condition.toLowerCase()} condition`;

  return `✨ FEATURE SPOTLIGHT: ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}

What makes this ${vehicle.bodyType} stand out? ${vehicle.description}

📌 Key Details:
• ${vehicle.year} ${vehicle.make} ${vehicle.model} — ${vehicle.trim} trim
• ${feature} with only ${mileageText} miles
• Stunning ${vehicle.color} exterior
• VIN: ${vehicle.vin}

💲 Asking: ${priceText}

Whether you're upgrading or finding your first luxury ride — this ${vehicle.make} delivers.

📬 DM to schedule your test drive!

${hashtags.map(h => '#' + h).join(' ')}`;
}
