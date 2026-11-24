import {
  Bike,
  BedDouble,
  Car,
  CarTaxiFront,
  Coffee,
  Flame,
  Footprints,
  Landmark,
  ShoppingBag,
  Sparkles,
  TrainFront,
  Trees,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryId, Theme, TravelMode } from './types';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  full: string;
  icon: LucideIcon;
  color: string;
  darkColor: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'eat',
    label: 'Eat',
    full: 'Eat & drink',
    icon: UtensilsCrossed,
    color: '#C2542E',
    darkColor: '#E27A4E',
  },
  {
    id: 'coffee',
    label: 'Coffee',
    full: 'Coffee & tea',
    icon: Coffee,
    color: '#8B5A34',
    darkColor: '#C29162',
  },
  {
    id: 'outdoors',
    label: 'Outdoors',
    full: 'Parks & lakes',
    icon: Trees,
    color: '#4E7A4B',
    darkColor: '#8CBF82',
  },
  {
    id: 'culture',
    label: 'Culture',
    full: 'Art & history',
    icon: Landmark,
    color: '#3F5D86',
    darkColor: '#91AFDC',
  },
  {
    id: 'worship',
    label: 'Worship',
    full: 'Temples & shrines',
    icon: Flame,
    color: '#B17D2F',
    darkColor: '#E2B45E',
  },
  {
    id: 'shop',
    label: 'Shops',
    full: 'Shops & markets',
    icon: ShoppingBag,
    color: '#7D4A66',
    darkColor: '#CE8FB0',
  },
  {
    id: 'stay',
    label: 'Stay',
    full: 'Places to stay',
    icon: BedDouble,
    color: '#2E6A64',
    darkColor: '#7DC3BA',
  },
  {
    id: 'transit',
    label: 'Transit',
    full: 'Getting around',
    icon: TrainFront,
    color: '#58616E',
    darkColor: '#A5AFBE',
  },
  {
    id: 'experience',
    label: 'Trips',
    full: 'Worth the trip',
    icon: Sparkles,
    color: '#A44551',
    darkColor: '#E28F98',
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category]),
) as Record<CategoryId, CategoryMeta>;

export function categoryColor(id: CategoryId, theme: Theme): string {
  const category = CATEGORY_BY_ID[id];
  return theme === 'dark' ? category.darkColor : category.color;
}

export interface ModeMeta {
  id: TravelMode;
  label: string;
  icon: LucideIcon;
  /** Typical door-to-door speed, in km/h, before a road factor. */
  speed: number;
  /** Time spent finding the vehicle, locking the bike, waiting at a signal. */
  overhead: number;
  directions: 'walking' | 'bicycling' | 'driving';
}

export const MODES: ModeMeta[] = [
  {
    id: 'walk',
    label: 'Walk',
    icon: Footprints,
    speed: 4.5,
    overhead: 0,
    directions: 'walking',
  },
  {
    id: 'bike',
    label: 'Cycle',
    icon: Bike,
    speed: 11,
    overhead: 2,
    directions: 'bicycling',
  },
  {
    id: 'auto',
    label: 'Auto',
    icon: CarTaxiFront,
    speed: 17,
    overhead: 4,
    directions: 'driving',
  },
  {
    id: 'cab',
    label: 'Cab',
    icon: Car,
    speed: 23,
    overhead: 6,
    directions: 'driving',
  },
];

export const MODE_BY_ID = Object.fromEntries(
  MODES.map((mode) => [mode.id, mode]),
) as Record<TravelMode, ModeMeta>;

export const TIME_STOPS = [5, 10, 15, 20, 30, 45, 60] as const;

export const DEFAULT_MODE: TravelMode = 'auto';
export const DEFAULT_MINUTES = 15;

export const DIET_LABEL: Record<string, string> = {
  veg: 'Vegetarian',
  nonveg: 'Non-vegetarian',
  both: 'Veg & non-veg',
};
