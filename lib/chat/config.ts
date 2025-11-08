import type { ChatChannel } from '@/types/chat';

// Knead chat channels configuration
export const KNEAD_CHANNELS: ChatChannel[] = [
  {
    id: 'main',
    name: 'Main',
    icon: '💬',
    description: 'General discussion for all topics',
    isOpenPeriod: false,
    requiresContributor: false,
  },
  {
    id: 'tech',
    name: 'Tech',
    icon: '💻',
    description: 'Technology, coding, and digital innovation',
    isOpenPeriod: false,
    requiresContributor: false,
  },
  {
    id: 'food',
    name: 'Food',
    icon: '🍽️',
    description: 'Culinary arts, recipes, and food culture',
    isOpenPeriod: false,
    requiresContributor: false,
  },
  {
    id: 'music',
    name: 'Music',
    icon: '🎵',
    description: 'Music production, artists, and sounds',
    isOpenPeriod: false,
    requiresContributor: false,
  },
  {
    id: 'art',
    name: 'Art',
    icon: '🎨',
    description: 'Visual arts, design, and creativity',
    isOpenPeriod: false,
    requiresContributor: false,
  },
  {
    id: 'fashion',
    name: 'Fashion',
    icon: '👗',
    description: 'Style, trends, and fashion culture',
    isOpenPeriod: false,
    requiresContributor: false,
  },
  {
    id: 'pitch-deck',
    name: 'Pitch Deck',
    icon: '📊',
    description: 'Share your projects and ideas',
    isOpenPeriod: false,
    requiresContributor: false,
  },
  {
    id: 'live-interviews',
    name: 'Live Interviews',
    icon: '🎙️',
    description: 'Voice and video interviews with contributors',
    isOpenPeriod: false,
    requiresContributor: true,
  },
];

export const TREASURY_CONFIG = {
  tokensPerLike: 1,
  contributorThreshold: 1000,
  maxLikesPerUser: 50,
};

export const FREEMIUM_CONFIG = {
  maxMinutesPerMonth: 30,
  warningThreshold: 25,
};