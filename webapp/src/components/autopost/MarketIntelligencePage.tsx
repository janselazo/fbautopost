import { MarketScanner } from './MarketScanner';
import type { Vehicle } from './types';

interface Props {
  vehicles: Vehicle[];
}

export function MarketIntelligencePage({ vehicles }: Props) {
  return (
    <div className="flex flex-col gap-5 animate-slide-up">
      <div>
        <h1 className="font-bebas text-3xl tracking-wider text-foreground">MARKET INTELLIGENCE</h1>
        <p className="font-dm text-sm text-muted-foreground mt-0.5">
          Real-time competitor analysis within your scan radius. Updates automatically.
        </p>
      </div>
      <MarketScanner vehicles={vehicles} compact={false} />
    </div>
  );
}
