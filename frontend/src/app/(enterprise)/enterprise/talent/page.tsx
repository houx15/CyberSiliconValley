import { PageTransition } from '@/components/animations/page-transition';

export default function TalentMarketPage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">人才市场</h1>
          <p className="text-sm text-muted-foreground">
            浏览所有可见人才，发现与您职位匹配的候选人。
          </p>
        </div>

        <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-border/60 text-sm text-muted-foreground">
          人才市场功能即将上线
        </div>
      </div>
    </PageTransition>
  );
}
