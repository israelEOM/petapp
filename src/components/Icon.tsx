import type { ReactElement } from 'react';
import { View, type ColorValue } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

/** Stroke icons drawn on a 24×24 grid; color comes from the parent group. */
const ICONS = {
  paw: (
    <>
      <Circle cx={6.5} cy={10} r={2} />
      <Circle cx={10} cy={5.5} r={2} />
      <Circle cx={14} cy={5.5} r={2} />
      <Circle cx={17.5} cy={10} r={2} />
      <Path d="M8 17.5c0-3 2-5.5 4-5.5s4 2.5 4 5.5c0 2-2 2.5-4 2.5s-4-.5-4-2.5Z" />
    </>
  ),
  ball: (
    <>
      <Circle cx={12} cy={12} r={8} />
      <Path d="M4.5 9.5c4.5 1.5 10.5 1.5 15 0M4.5 14.5c4.5-1.5 10.5-1.5 15 0" />
    </>
  ),
  bowl: (
    <>
      <Path d="M3 12h18a9 8 0 0 1-18 0Z" />
      <Path d="M9 8c0-1.5 1-2 2-2M14 8c0-1.5 1-2 2-2" />
    </>
  ),
  drop: <Path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />,
  shield: (
    <>
      <Path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z" />
      <Path d="M9 12l2 2 4-4" />
    </>
  ),
  flame: <Path d="M12 3c1 4 6 5.5 6 11a6 6 0 0 1-12 0c0-3.5 2.5-4.5 3-7 1.5 1 2.5 2.5 2.5 4.5" />,
  trophy: (
    <>
      <Path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <Path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6" />
    </>
  ),
  star: <Path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />,
  heart: <Path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />,
  home: <Path d="M4 11l8-7 8 7v9h-5v-6H9v6H4Z" />,
  check: <Path d="M5 12l5 5 9-10" />,
  lock: (
    <>
      <Rect x={5} y={11} width={14} height={10} rx={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  'chevron-left': <Path d="M15 5l-7 7 7 7" />,
  'chevron-right': <Path d="M9 5l7 7-7 7" />,
  pill: (
    <>
      <Rect x={4} y={9} width={16} height={6} rx={3} />
      <Path d="M12 9v6" />
    </>
  ),
  syringe: <Path d="M18 2l4 4M15 5l4 4M7 13l4 4M3 21l4-4M17 7L8 16l-2-2 9-9" />,
  calendar: (
    <>
      <Rect x={4} y={5} width={16} height={15} rx={3} />
      <Path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  bell: (
    <>
      <Path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15Z" />
      <Path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  minus: <Path d="M5 12h14" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  user: (
    <>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
  strokeWidth?: number;
  /** Fills closed shapes (used for the active tab icon); outline only by default. */
  fill?: ColorValue;
}

export function Icon({ name, size = 24, color = colors.ink, strokeWidth = 2, fill = 'none' }: IconProps) {
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <G fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {ICONS[name]}
        </G>
      </Svg>
    </View>
  );
}
