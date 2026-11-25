import type { CategoryId } from '../lib/types';

export function coverSeed(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 360;
  }
  return hash;
}

/**
 * A designed cover for places with no open photograph. The drawing is chosen
 * by category and shifted by a seed, so every card gets its own small scene
 * instead of the same generic icon.
 */
export default function CoverArt({
  cat,
  seed,
  className,
}: {
  cat: CategoryId;
  seed: number;
  className?: string;
}) {
  const tilt = (seed % 7) - 3;
  const shiftX = ((seed * 13) % 15) - 7;
  const shiftY = ((seed * 7) % 11) - 5;

  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g
        transform={`translate(${shiftX} ${shiftY}) rotate(${tilt} 60 60)`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Scene cat={cat} />
      </g>
      <circle cx={18 + (seed % 9)} cy={20 + (seed % 7)} r="1.2" fill="currentColor" opacity="0.55" />
      <circle cx={103 - (seed % 11)} cy={31 + (seed % 13)} r="0.9" fill="currentColor" opacity="0.4" />
      <path
        d={`M ${92 - (seed % 8)} 96 l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 z`}
        fill="currentColor"
        opacity="0.22"
      />
    </svg>
  );
}

function Scene({ cat }: { cat: CategoryId }) {
  if (cat === 'eat') {
    return (
      <>
        <ellipse cx="60" cy="68" rx="35" ry="15" fill="currentColor" opacity="0.12" />
        <path d="M31 66c4-17 17-27 29-27s25 10 29 27" fill="currentColor" opacity="0.18" />
        <path d="M31 66c4-17 17-27 29-27s25 10 29 27" />
        <path d="M28 67h64" />
        <ellipse cx="45" cy="86" rx="7" ry="3.4" />
        <ellipse cx="60" cy="89" rx="7" ry="3.4" />
        <ellipse cx="75" cy="86" rx="7" ry="3.4" />
      </>
    );
  }

  if (cat === 'coffee') {
    return (
      <>
        <path d="M38 52h42v20a13 13 0 0 1-13 13H51a13 13 0 0 1-13-13z" fill="currentColor" opacity="0.14" />
        <path d="M38 52h42v20a13 13 0 0 1-13 13H51a13 13 0 0 1-13-13z" />
        <path d="M80 58h6a8 8 0 0 1 0 16h-6" />
        <path d="M32 93h56" />
        <path d="M50 40c-4-5 4-8 0-13" opacity="0.7" />
        <path d="M60 38c-4-5 4-8 0-13" opacity="0.7" />
        <path d="M70 40c-4-5 4-8 0-13" opacity="0.7" />
      </>
    );
  }

  if (cat === 'outdoors') {
    return (
      <>
        <circle cx="82" cy="35" r="9" fill="currentColor" opacity="0.2" />
        <circle cx="82" cy="35" r="9" />
        <path d="M18 78l22-30 15 19 12-15 27 26" fill="currentColor" opacity="0.12" />
        <path d="M18 78l22-30 15 19 12-15 27 26" />
        <path d="M18 85c12-4 22 4 34 0s22 4 34 0 14 1 16 0" opacity="0.8" />
        <path d="M18 94c12-4 22 4 34 0s22 4 34 0 14 1 16 0" opacity="0.5" />
      </>
    );
  }

  if (cat === 'culture') {
    return (
      <>
        <path d="M27 48l33-22 33 22z" fill="currentColor" opacity="0.14" />
        <path d="M27 48h66M33 48v38M52 48v38M68 48v38M87 48v38M25 89h70" />
        <path d="M42 65h12M66 65h12" opacity="0.65" />
        <circle cx="60" cy="18" r="2.2" fill="currentColor" opacity="0.6" />
      </>
    );
  }

  if (cat === 'worship') {
    return (
      <>
        <path d="M36 88V63l8-8V44l8-8V25h16v11l8 8v11l8 8v25z" fill="currentColor" opacity="0.12" />
        <path d="M36 88V63l8-8V44l8-8V25h16v11l8 8v11l8 8v25z" />
        <path d="M30 88h60M52 88V76a8 8 0 0 1 16 0v12" />
        <path d="M60 25v-9M56 20h8" opacity="0.75" />
        <path d="M48 50h8M64 50h8" opacity="0.55" />
      </>
    );
  }

  if (cat === 'shop') {
    return (
      <>
        <path d="M28 48h64l-5 41H33z" fill="currentColor" opacity="0.11" />
        <path d="M28 48h64l-5 41H33z" />
        <path d="M24 48h72l-7-13H31z" fill="currentColor" opacity="0.16" />
        <path d="M31 35l9 13M45 35l5 13M60 35v13M75 35l-5 13M89 35l-9 13" opacity="0.7" />
        <path d="M50 65h20M50 73h14" opacity="0.6" />
      </>
    );
  }

  if (cat === 'stay') {
    return (
      <>
        <path d="M26 82V48l34-20 34 20v34z" fill="currentColor" opacity="0.1" />
        <path d="M26 82V48l34-20 34 20v34" />
        <path d="M38 82V55h44v27M38 68h44" />
        <path d="M26 55h10M84 55h10" opacity="0.5" />
        <circle cx="60" cy="34" r="2" fill="currentColor" opacity="0.5" />
      </>
    );
  }

  return (
    <>
      <circle cx="60" cy="58" r="30" fill="currentColor" opacity="0.1" />
      <circle cx="60" cy="58" r="30" />
      <circle cx="60" cy="58" r="21" opacity="0.65" />
      <path d="M60 23l5 30-5 5-5-5z" fill="currentColor" opacity="0.45" />
      <path d="M60 93l-5-30 5-5 5 5z" opacity="0.7" />
      <circle cx="60" cy="58" r="2.6" fill="currentColor" />
    </>
  );
}
