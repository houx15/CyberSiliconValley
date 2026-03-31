import { Skeleton } from '@/components/ui/skeleton';

const NODE_LAYOUT = [
  { left: '14%', top: '20%', width: 78 },
  { left: '28%', top: '36%', width: 92 },
  { left: '46%', top: '16%', width: 96 },
  { left: '61%', top: '34%', width: 86 },
  { left: '77%', top: '24%', width: 72 },
  { left: '19%', top: '59%', width: 82 },
  { left: '38%', top: '68%', width: 88 },
  { left: '58%', top: '58%', width: 94 },
  { left: '74%', top: '71%', width: 84 },
];

export function GraphSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <Skeleton className="h-10 w-64 rounded-xl" />

      <div className="relative h-[500px] overflow-hidden rounded-3xl border border-border/60 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,0.02),_rgba(255,255,255,0))]">
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        {NODE_LAYOUT.map((node, index) => (
          <Skeleton
            key={index}
            className="absolute h-8 rounded-full"
            style={{ left: node.left, top: node.top, width: node.width }}
          />
        ))}
        <div className="absolute inset-x-0 bottom-6 text-center text-sm text-muted-foreground">
          Loading graph...
        </div>
      </div>
    </div>
  );
}
