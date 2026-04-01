import { siSnapchat, siTiktok } from 'simple-icons';
import { useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export type BrandAppId = 'tiktok' | 'snapchat' | 'instagram' | 'facebook';

type Props = {
  name: BrandAppId;
  size: number;
};

/** Meta / Facebook brand blue (2023+). */
const FB_BLUE = '#0866FF';
/** White “f” for 24×24 squircle (vector aligned to common app-icon proportions). */
const FB_F_PATH =
  'M15.36 12h-2.45v7.8H9.58V12H7.5V9.35h2.08V7.8c0-2.06 1.18-3.2 2.98-3.2 1.6 0 2.51.12 2.51.12v2.47h-1.44c-.71 0-.94.44-.94 1.12V9.35h2.66L15.36 12z';
/** Snapchat Spectacles yellow. */
const SNAP_YELLOW = '#FFFC00';
/** TikTok brand neons (official palette). */
const TT_CYAN = '#25F4EE';
const TT_RED = '#EE1D52';

/**
 * High-fidelity marks: TikTok uses layered chromatic offsets like the real logo;
 * Snapchat: #FFFC00 tile, ghost from Simple Icons scaled/centered + black outline (app style);
 * Instagram: gradient tile + white-stroke camera (body + lens); gradient shows through openings;
 * Facebook: Meta-blue squircle + white “f” (app-style tile).
 */
export function BrandAppIcon({ name, size }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const igGradId = `ig-${uid}`;

  if (name === 'tiktok') {
    const d = siTiktok.path;
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
        <Path d={d} fill={TT_CYAN} transform="translate(-0.65 -0.65)" />
        <Path d={d} fill={TT_RED} transform="translate(0.65 0.65)" />
        <Path d={d} fill="#000000" />
      </Svg>
    );
  }

  if (name === 'snapchat') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
        <Rect x={0} y={0} width={24} height={24} rx={5.5} ry={5.5} fill={SNAP_YELLOW} />
        {/* Ghost: slight scale + nudge so it matches in-app padding; stroke = official black outline */}
        <G transform="translate(12, 12.05) scale(0.905) translate(-12, -12)">
          <Path
            d={siSnapchat.path}
            fill="#FFFFFF"
            stroke="#000000"
            strokeWidth={0.42}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      </Svg>
    );
  }

  if (name === 'instagram') {
    const white = '#FFFFFF';
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
        <Defs>
          <LinearGradient
            id={igGradId}
            x1="0%"
            y1="100%"
            x2="100%"
            y2="0%"
            gradientUnits="objectBoundingBox"
          >
            <Stop offset="0" stopColor="#feda75" />
            <Stop offset="0.22" stopColor="#fa7e1e" />
            <Stop offset="0.42" stopColor="#d62976" />
            <Stop offset="0.65" stopColor="#962fbf" />
            <Stop offset="1" stopColor="#4f5bd5" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={24} height={24} rx={5.75} ry={5.75} fill={`url(#${igGradId})`} />
        {/* Camera body: white outline only (interior shows gradient). */}
        <Rect
          x={5.05}
          y={5.05}
          width={13.9}
          height={13.9}
          rx={3.4}
          ry={3.4}
          fill="none"
          stroke={white}
          strokeWidth={1.18}
        />
        {/* Lens: white ring only */}
        <Circle
          cx={12}
          cy={12}
          r={3.08}
          fill="none"
          stroke={white}
          strokeWidth={1.08}
        />
        {/* Viewfinder dot */}
        <Circle cx={17.2} cy={6.8} r={0.92} fill={white} />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Rect x={0} y={0} width={24} height={24} rx={5.5} ry={5.5} fill={FB_BLUE} />
      <Path d={FB_F_PATH} fill="#FFFFFF" />
    </Svg>
  );
}
