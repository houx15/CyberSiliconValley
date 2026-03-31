import { Badge } from '@/components/ui/badge';

interface InboxBadgeProps {
  count?: number;
}

export function InboxBadge({ count = 0 }: InboxBadgeProps) {
  if (count <= 0) {
    return null;
  }

  return <Badge variant="destructive">{count > 99 ? '99+' : count}</Badge>;
}
