import type { Metadata } from 'next';
import { V3Shell } from '@/components/v3/V3Shell';
import { WeeklyHeatTop } from '@/components/v3/WeeklyHeat';
import { TaskDiscovery } from '@/components/v3/TaskDiscovery';
import { DiscoveryTelemetry } from '@/components/v3/DiscoveryTelemetry';
import { NewsletterSignup } from '@/components/v3/NewsletterForm';
import { SubscribeHash } from '@/components/v3/SubscribeHash';
import { homePageMetadata } from '@/lib/page-meta';

export const revalidate = 45;

export const metadata: Metadata = homePageMetadata();

export default function HomePage() {
  return (
    <V3Shell>
      <main>
        <SubscribeHash />
        <WeeklyHeatTop>
          <NewsletterSignup location="home" />
        </WeeklyHeatTop>
        <TaskDiscovery />
        <DiscoveryTelemetry />
      </main>
    </V3Shell>
  );
}
