import RankingsDecodedLanding from '@/components/landing/RankingsDecodedLanding';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rankings Decoded — Legal Market Intelligence, Strategy & Advisory',
  description: 'Independent advice for stronger competitive positioning and smarter business decisions. Specialist advice, competitive benchmarking, and submission support led by Ángela Castillo.',
  openGraph: {
    title: 'Rankings Decoded — Legal Market Intelligence, Strategy & Advisory',
    description: 'A clearer view of your firm. A stronger competitive position. Specialist advice, personal attention, and submission support, backed by proprietary technology. Led by Ángela Castillo.',
    type: 'website',
  },
};

export default function Home() {
  return <RankingsDecodedLanding />;
}
