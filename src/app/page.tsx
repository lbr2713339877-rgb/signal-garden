import { V3Shell } from '@/components/v3/V3Shell';
import { Section01Hero } from '@/components/v3/Section01Hero';
import { TodaySignals } from '@/components/v3/TodaySignals';
import { NoiseToSignal } from '@/components/v3/NoiseToSignal';
import { TaskDiscovery } from '@/components/v3/TaskDiscovery';
import { DiscoveryTelemetry } from '@/components/v3/DiscoveryTelemetry';
import { TODAY_LIMIT } from '@/lib/edition';
import { NewsletterSignup } from '@/components/v3/NewsletterForm';

export const revalidate = 45;

export default async function HomePage() {
  return (
    <V3Shell>
      <main>
        <Section01Hero />
        <NoiseToSignal />
        <TodaySignals limit={TODAY_LIMIT} />
        <NewsletterSignup source="home" />
        <TaskDiscovery />
        <DiscoveryTelemetry />
      </main>
    </V3Shell>
  );
}
