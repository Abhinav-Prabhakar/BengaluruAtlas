import {
  Beer,
  BedDouble,
  Bird,
  BookOpen,
  Building2,
  Castle,
  Church,
  Coffee,
  CookingPot,
  Croissant,
  CupSoda,
  Fish,
  Flame,
  Footprints,
  Gem,
  Hamburger,
  IceCreamBowl,
  Landmark,
  Leaf,
  Mountain,
  Music,
  Palette,
  Pizza,
  Salad,
  Sandwich,
  Shirt,
  ShoppingBasket,
  Soup,
  Store,
  Sunrise,
  Theater,
  Trees,
  UtensilsCrossed,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { Place } from './types';

export type MoodGroup = 'eat' | 'out' | 'culture' | 'shop' | 'stay' | 'night';

export interface Mood {
  id: string;
  label: string;
  hint: string;
  group: MoodGroup;
  icon: LucideIcon;
  color: string;
  darkColor: string;
  test: (place: Place, text: string) => boolean;
}

export const MOOD_GROUPS: { id: MoodGroup; label: string; blurb: string }[] = [
  { id: 'eat', label: 'Eat & drink', blurb: 'From a 7am dose to a late pint.' },
  { id: 'out', label: 'Out & about', blurb: 'Lakes, lawns and long walks.' },
  { id: 'culture', label: 'Culture & quiet', blurb: 'Old stones, new art, still rooms.' },
  { id: 'shop', label: 'Shop & browse', blurb: 'Markets, books and things made here.' },
  { id: 'stay', label: 'Stay & unwind', blurb: 'For when the day runs long.' },
  { id: 'night', label: 'After dark', blurb: 'Music, terraces and a cold one.' },
];

const has = (text: string, pattern: RegExp) => pattern.test(text);

export const MOODS: Mood[] = [
  // ── Eat & drink ────────────────────────────────────────────────────────────
  {
    id: 'breakfast',
    label: 'Breakfast',
    hint: 'Dosas, idlis and filter coffee before the city wakes',
    group: 'eat',
    icon: UtensilsCrossed,
    color: '#C2542E',
    darkColor: '#E27A4E',
    test: (place, text) =>
      (place.cat === 'eat' || place.cat === 'coffee') &&
      has(
        text,
        /breakfast|dosa|idli|tiffin|vada|poha|upma|filter coffee|benne|south indian|udupi|darshini|bhavan|sagar|morning/,
      ),
  },
  {
    id: 'coffee',
    label: 'Filter coffee',
    hint: 'Kaapi, roasters and slow cafe corners',
    group: 'eat',
    icon: Coffee,
    color: '#8B5A34',
    darkColor: '#C29162',
    test: (place, text) => place.cat === 'coffee' || has(text, /coffee|kaapi|espresso|roaster|brew bar/),
  },
  {
    id: 'bakery',
    label: 'Bakeries',
    hint: 'Bread, cake and old-school puffs',
    group: 'eat',
    icon: Croissant,
    color: '#B5713F',
    darkColor: '#DDA476',
    test: (place, text) => has(text, /bakery|bakehouse|bread|cake|pastry|croissant|patisserie|puff/),
  },
  {
    id: 'street-food',
    label: 'Street food',
    hint: 'Chaat, grills and food streets',
    group: 'eat',
    icon: Flame,
    color: '#C4622B',
    darkColor: '#E8935B',
    test: (place, text) => has(text, /street food|chaat|pani puri|pav bhaji|food street|sweet|snack|grill/),
  },
  {
    id: 'biryani',
    label: 'Biryani & grills',
    hint: 'Dum biryani, kebabs and military hotels',
    group: 'eat',
    icon: UtensilsCrossed,
    color: '#A44551',
    darkColor: '#E28F98',
    test: (place, text) => has(text, /biryani|kebab|kabab|mughlai|andhra|hyderabadi|military hotel/),
  },
  {
    id: 'chinese',
    label: 'Chinese',
    hint: 'Indo-Chinese, noodles and late-night Manchurian',
    group: 'eat',
    icon: CookingPot,
    color: '#A44538',
    darkColor: '#E8907F',
    test: (place, text) =>
      place.cat === 'eat' && has(text, /chinese|sichuan|schezwan|szechuan|noodle|dim sum|manchurian|chow mein/),
  },
  {
    id: 'pizza',
    label: 'Pizza & pasta',
    hint: 'Wood-fired, thin-crust and red-sauce comfort',
    group: 'eat',
    icon: Pizza,
    color: '#B5713F',
    darkColor: '#DDA476',
    test: (place, text) => has(text, /pizza|pizzeria|italian|pasta|risotto/),
  },
  {
    id: 'burgers',
    label: 'Burgers',
    hint: 'Smash patties, fried chicken and old-school joints',
    group: 'eat',
    icon: Hamburger,
    color: '#9A6B2F',
    darkColor: '#DCB676',
    test: (place, text) => has(text, /burger|hamburger|fried chicken|wings/),
  },
  {
    id: 'sandwiches',
    label: 'Sandwiches',
    hint: 'Bombay grills, subs and quick stacks',
    group: 'eat',
    icon: Sandwich,
    color: '#8A6A45',
    darkColor: '#D2B187',
    test: (place, text) => has(text, /sandwich|sub|bagel|toastie|grilled/),
  },
  {
    id: 'desserts',
    label: 'Sweet tooth',
    hint: 'Ice cream, cake and old bakery counters',
    group: 'eat',
    icon: IceCreamBowl,
    color: '#8B5A7A',
    darkColor: '#D9A0C3',
    test: (place, text) =>
      (place.cat === 'eat' || place.cat === 'coffee') &&
      has(text, /ice cream|gelato|dessert|cake|pastry|sweet|mithai|bakery|chocolate/),
  },
  {
    id: 'juice',
    label: 'Juice & shakes',
    hint: 'Sugarcane, fresh lime and cold blends',
    group: 'eat',
    icon: CupSoda,
    color: '#4E7A4B',
    darkColor: '#8CBF82',
    test: (place, text) => has(text, /juice|smoothie|shake|milkshake|lassi|sugarcane/),
  },
  {
    id: 'asian',
    label: 'Asian kitchens',
    hint: 'Sushi, ramen, Thai and Korean tables',
    group: 'eat',
    icon: Soup,
    color: '#4F6F63',
    darkColor: '#8FBFAE',
    test: (place, text) =>
      place.cat === 'eat' &&
      has(text, /japanese|korean|thai|vietnamese|sushi|ramen|asian|pan asian|dim sum/),
  },
  {
    id: 'seafood',
    label: 'Seafood',
    hint: 'Coastal fry, fish thalis and prawn curry',
    group: 'eat',
    icon: Fish,
    color: '#3F6F86',
    darkColor: '#8FC4D9',
    test: (place, text) => has(text, /seafood|fish|prawn|crab|mangalorean|coastal/),
  },
  {
    id: 'salads',
    label: 'Salads & bowls',
    hint: 'Greens, grain bowls and lighter plates',
    group: 'eat',
    icon: Salad,
    color: '#4E7A4B',
    darkColor: '#8CBF82',
    test: (place, text) => has(text, /salad|bowl|healthy|vegan|gluten free/),
  },
  {
    id: 'veg',
    label: 'Pure veg',
    hint: 'Vegetarian kitchens, old and new',
    group: 'eat',
    icon: Leaf,
    color: '#4E7A4B',
    darkColor: '#8CBF82',
    test: (place, text) =>
      place.diet === 'veg' || has(text, /vegetarian|pure veg|veg only|veg restaurant/),
  },
  {
    id: 'bars',
    label: 'Bars & pubs',
    hint: 'Craft beer, cocktails and old Bangalore boozers',
    group: 'eat',
    icon: Beer,
    color: '#B17D2F',
    darkColor: '#E2B45E',
    test: (place, text) =>
      place.cat === 'eat' && has(text, /bar|pub|brew|beer|cocktail|tavern|lounge|taproom/),
  },

  // ── Out & about ────────────────────────────────────────────────────────────
  {
    id: 'lakes',
    label: 'Lakes',
    hint: 'Water, birds and the evening breeze',
    group: 'out',
    icon: Waves,
    color: '#3F6F86',
    darkColor: '#8FC4D9',
    test: (place, text) => place.cat === 'outdoors' && has(text, /lake|reservoir|kere|tank/),
  },
  {
    id: 'parks',
    label: 'Parks',
    hint: 'Lawns, gardens and shady loops',
    group: 'out',
    icon: Trees,
    color: '#4E7A4B',
    darkColor: '#8CBF82',
    test: (place, text) =>
      place.cat === 'outdoors' && has(text, /park|garden|green|lawn|nursery|grove/),
  },
  {
    id: 'sunsets',
    label: 'Sunsets',
    hint: 'Rocks, terraces and west-facing water',
    group: 'out',
    icon: Sunrise,
    color: '#C97A3D',
    darkColor: '#F0A972',
    test: (place, text) => has(text, /sunset|viewpoint|view point|hill|rock|betta|terrace|rooftop/),
  },
  {
    id: 'walks',
    label: 'Walks',
    hint: 'Neighbourhood loops and long strolls',
    group: 'out',
    icon: Footprints,
    color: '#6B7A45',
    darkColor: '#B3C388',
    test: (place, text) =>
      (place.cat === 'outdoors' || place.cat === 'experience') &&
      has(text, /walk|trail|promenade|jog|loop|stroll|neighbourhood/),
  },
  {
    id: 'wildlife',
    label: 'Birds & wildlife',
    hint: 'Lakes, parks and the city’s early risers',
    group: 'out',
    icon: Bird,
    color: '#4F7F63',
    darkColor: '#8FC7A6',
    test: (place, text) =>
      has(text, /wildlife|zoo|sanctuary|aviary|butterfly|bannerghatta|bird/) ||
      (place.cat === 'outdoors' && has(text, /lake|kere|reservoir|tank|park|garden/)),
  },
  {
    id: 'day-trips',
    label: 'Day trips',
    hint: 'Out past the ring road for the day',
    group: 'out',
    icon: Mountain,
    color: '#7D6A4A',
    darkColor: '#C6B087',
    test: (place) => place.cat === 'experience',
  },

  // ── Culture & quiet ────────────────────────────────────────────────────────
  {
    id: 'museums',
    label: 'Museums',
    hint: 'Collections, archives and planetariums',
    group: 'culture',
    icon: Landmark,
    color: '#3F5D86',
    darkColor: '#91AFDC',
    test: (place, text) =>
      place.cat === 'culture' && has(text, /museum|archive|collection|planetarium/),
  },
  {
    id: 'art',
    label: 'Art & design',
    hint: 'Galleries, murals and studios',
    group: 'culture',
    icon: Palette,
    color: '#7D4A66',
    darkColor: '#CE8FB0',
    test: (place, text) => has(text, /gallery|art|mural|sculpture|design|studio/),
  },
  {
    id: 'temples',
    label: 'Temples',
    hint: 'Old stone, lamplit shrines and quiet courtyards',
    group: 'culture',
    icon: Flame,
    color: '#B17D2F',
    darkColor: '#E2B45E',
    test: (place, text) =>
      place.cat === 'worship' && has(text, /temple|gudi|kovil|math|shrine|devasthanam/),
  },
  {
    id: 'churches',
    label: 'Churches',
    hint: 'Steeples, stained glass and Sunday choirs',
    group: 'culture',
    icon: Church,
    color: '#5A6E8C',
    darkColor: '#AFC0D9',
    test: (place, text) =>
      place.cat === 'worship' && has(text, /church|basilica|cathedral|chapel|parish/),
  },
  {
    id: 'heritage',
    label: 'Heritage',
    hint: 'Forts, palaces and colonial leftovers',
    group: 'culture',
    icon: Castle,
    color: '#8A6A45',
    darkColor: '#D2B187',
    test: (place, text) =>
      place.cat === 'culture' &&
      has(text, /heritage|fort|palace|monument|memorial|soudha|colonial|historic|ruins|tower/),
  },
  {
    id: 'bookshops',
    label: 'Bookshops',
    hint: 'Shelves to disappear into',
    group: 'culture',
    icon: BookOpen,
    color: '#6B5A3E',
    darkColor: '#C4AF87',
    test: (place, text) => has(text, /book|library|reading|publisher/),
  },
  {
    id: 'theatre',
    label: 'Theatre',
    hint: 'Stages, screens and small auditoriums',
    group: 'culture',
    icon: Theater,
    color: '#7A4A5C',
    darkColor: '#CE93A6',
    test: (place, text) => has(text, /theatre|theater|cinema|auditorium|amphitheatre|stage|performance/),
  },

  // ── Shop & browse ──────────────────────────────────────────────────────────
  {
    id: 'markets',
    label: 'Markets',
    hint: 'Flowers, vegetables and Sunday santhe',
    group: 'shop',
    icon: ShoppingBasket,
    color: '#7D4A66',
    darkColor: '#CE8FB0',
    test: (place, text) => has(text, /market|bazaar|santhe|flower|vegetable|produce/),
  },
  {
    id: 'boutiques',
    label: 'Boutiques',
    hint: 'Silk, tailoring and small labels',
    group: 'shop',
    icon: Shirt,
    color: '#8A5A70',
    darkColor: '#D6A0B8',
    test: (place, text) =>
      has(
        text,
        /boutique|clothing|clothes|silk|fashion|tailor|designer|saree|apparel|fabric/,
      ),
  },
  {
    id: 'craft',
    label: 'Art & craft',
    hint: 'Handmade, antique and one-off',
    group: 'shop',
    icon: Gem,
    color: '#6E5A7D',
    darkColor: '#B9A6CC',
    test: (place, text) => has(text, /craft|antique|handicraft|pottery|souvenir|art shop|gallery/),
  },

  // ── Stay & unwind ──────────────────────────────────────────────────────────
  {
    id: 'stays',
    label: 'Places to stay',
    hint: 'Hotels, homestays and quiet rooms',
    group: 'stay',
    icon: BedDouble,
    color: '#2E6A64',
    darkColor: '#7DC3BA',
    test: (place) => place.cat === 'stay',
  },
  {
    id: 'heritage-stays',
    label: 'Heritage stays',
    hint: 'Sleep in an old bungalow or palace',
    group: 'stay',
    icon: Castle,
    color: '#5E6A4A',
    darkColor: '#B5C394',
    test: (place, text) =>
      place.cat === 'stay' && has(text, /heritage|palace|colonial|bungalow|manor|villa|estate/),
  },

  // ── After dark ─────────────────────────────────────────────────────────────
  {
    id: 'live-music',
    label: 'Live music',
    hint: 'Jazz, gigs and small stages',
    group: 'night',
    icon: Music,
    color: '#6A4A86',
    darkColor: '#B79AD6',
    test: (place, text) => has(text, /music|jazz|live|concert|gig|acoustic/),
  },
  {
    id: 'breweries',
    label: 'Breweries',
    hint: 'Tanks, taps and long tables',
    group: 'night',
    icon: Beer,
    color: '#9A6B2F',
    darkColor: '#DCB676',
    test: (place, text) => has(text, /brew|beer|taproom|brewpub/),
  },
  {
    id: 'rooftops',
    label: 'Rooftops',
    hint: 'Open air, skyline and a cold drink',
    group: 'night',
    icon: Building2,
    color: '#4E6A86',
    darkColor: '#9FBBD6',
    test: (place, text) => has(text, /rooftop|terrace|sky bar|skyline|open air/),
  },
];

export const MOOD_BY_ID = Object.fromEntries(MOODS.map((mood) => [mood.id, mood])) as Record<
  string,
  Mood
>;

/** The twelve that earn their place on the first screen. */
export const FEATURED_MOODS = [
  'breakfast',
  'coffee',
  'chinese',
  'pizza',
  'biryani',
  'bars',
  'lakes',
  'parks',
  'museums',
  'temples',
  'markets',
  'bookshops',
];

export function moodColor(mood: Mood, theme: 'light' | 'dark'): string {
  return theme === 'dark' ? mood.darkColor : mood.color;
}

export const MOON_MOOD = Music;
export const STORE_ICON = Store;
