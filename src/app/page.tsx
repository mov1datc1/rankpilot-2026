import RankingsDecodedLanding from '@/components/landing/RankingsDecodedLanding';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rankings Decoded — Legal Rankings Strategy & Advisory',
  description: 'Specialist advice, personal attention, and submission support for law firms pursuing Chambers and Partners, The Legal 500, IFLR1000, and Leaders League. Led by Ángela Castillo.',
  openGraph: {
    title: 'Rankings Decoded — Legal Rankings Strategy & Advisory',
    description: 'A clearer view of your firm. A stronger case for recognition. Specialist advice, personal attention, and submission support, backed by proprietary technology.',
    type: 'website',
  },
};

export default function Home() {
  return <RankingsDecodedLanding />;
}
