import { useState } from 'react';
import { BookOpen, Mail, Users, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: 'How do I connect my Facebook account?',
    answer:
      'Go to Settings and click "Connect Facebook Account". You will be redirected to Facebook to authorize the AutoPost app. Once connected, your listings will be able to post directly to Facebook Marketplace.',
  },
  {
    question: 'Can I schedule posts in advance?',
    answer:
      'Yes! When composing a post, select the "Schedule" option and choose your desired date and time. Scheduled posts will appear in your Post History with a "Scheduled" status badge.',
  },
  {
    question: 'How do I import vehicles from my DMS?',
    answer:
      'AutoPost supports CSV import from most major dealer management systems. Navigate to the Inventory tab, click "Import", and upload your exported CSV file. Column mapping is handled automatically for common DMS formats.',
  },
  {
    question: 'What happens when a vehicle sells?',
    answer:
      'When you mark a vehicle as Sold in your inventory, AutoPost will automatically remove the active Facebook Marketplace listing if it was posted through AutoPost. The vehicle will then appear in your Sold Vehicles view.',
  },
];

function FaqAccordion({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-secondary/30 transition-colors"
      >
        <span className="font-dm text-sm font-medium text-foreground">{item.question}</span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-4">
          <p className="font-dm text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
        </div>
      )}
    </div>
  );
}

export function SupportView() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-bebas text-4xl tracking-wider text-foreground leading-none">SUPPORT</h1>
        <p className="font-dm text-sm text-muted-foreground mt-1">
          Get help with AutoPost and your Facebook Marketplace listings.
        </p>
      </div>

      {/* Support cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition-colors cursor-pointer group">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-bebas text-xl tracking-wider text-foreground mb-1">DOCUMENTATION</h3>
          <p className="font-dm text-xs text-muted-foreground leading-relaxed mb-4">
            Browse our full documentation for setup guides, feature walkthroughs, and best practices.
          </p>
          <div className="flex items-center gap-1.5 font-dm text-xs text-primary font-medium">
            View Docs <ExternalLink className="w-3 h-3" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition-colors cursor-pointer group">
          <div className="w-10 h-10 rounded-md bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
            <Mail className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="font-bebas text-xl tracking-wider text-foreground mb-1">CONTACT SUPPORT</h3>
          <p className="font-dm text-xs text-muted-foreground leading-relaxed mb-4">
            Having an issue? Our support team is available Monday–Friday, 9am–6pm EST.
          </p>
          <div className="flex items-center gap-1.5 font-dm text-xs text-blue-400 font-medium">
            support@autopost.io <ExternalLink className="w-3 h-3" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition-colors cursor-pointer group">
          <div className="w-10 h-10 rounded-md bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <h3 className="font-bebas text-xl tracking-wider text-foreground mb-1">COMMUNITY FORUM</h3>
          <p className="font-dm text-xs text-muted-foreground leading-relaxed mb-4">
            Join other dealers sharing tips, templates, and strategies for Marketplace success.
          </p>
          <div className="flex items-center gap-1.5 font-dm text-xs text-purple-400 font-medium">
            Join Forum <ExternalLink className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-bebas text-xl tracking-wider text-foreground">FREQUENTLY ASKED QUESTIONS</h2>
        </div>
        <div>
          {faqs.map((faq, index) => (
            <FaqAccordion key={index} item={faq} />
          ))}
        </div>
      </div>
    </div>
  );
}
