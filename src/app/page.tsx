import { FeatureHighlights } from '@/components/landing/feature-highlights';
import { FinalCta } from '@/components/landing/final-cta';
import { HeroSection } from '@/components/landing/hero-section';
import { HowItWorks } from '@/components/landing/how-it-works';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <HeroSection />
      <HowItWorks />
      <FeatureHighlights />
      <FinalCta />
    </main>
  );
}
