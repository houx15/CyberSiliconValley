import { PageTransition } from '@/components/animations/page-transition';
import { TalentMarketList } from '@/components/enterprise/talent-market-list';

export default function TalentMarketPage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">人才市场</h1>
          <p className="text-sm text-muted-foreground">
            浏览所有可见人才，发现与您需求匹配的候选人。
          </p>
        </div>

        <TalentMarketList />
      </div>
    </PageTransition>
  );
}
