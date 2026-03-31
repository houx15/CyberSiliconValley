/**
 * Standalone layout for enterprise onboarding — full-screen, no sidebar.
 * This route lives OUTSIDE the (enterprise) route group intentionally.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Minimal header */}
      <header className="flex items-center justify-between border-b border-border/30 px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-purple-500 opacity-80" />
          <span className="text-sm font-medium text-foreground">CSV</span>
        </div>
        <span className="text-xs text-muted-foreground">Enterprise Onboarding</span>
      </header>
      {/* Content */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
