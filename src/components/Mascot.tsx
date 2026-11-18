import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { nativeDriver } from '@/lib/platform';

export type MascotMood = 'neutral' | 'happy';

interface MascotProps {
  size?: number;
  mood?: MascotMood;
  /** waves a paw and winks (welcome screen) */
  wave?: boolean;
  /** change this number to make Pipoca hop once, e.g. after every logged action */
  pulse?: number;
  /** draw the soft ground shadow */
  shadow?: boolean;
}

const INK = '#1F1B3A';
const FUR = '#F4B77E';
const EAR = '#A8683F';
const MUZZLE = '#FFE8D1';
const CHEEK = '#FF8A8A';
const TONGUE = '#FF6F7D';

/** Pipoca, the app's puppy. Drawn on a 200×200 grid. */
export function Mascot({ size = 150, mood = 'neutral', wave = false, pulse = 0, shadow = true }: MascotProps) {
  const happy = mood === 'happy';
  const scale = size / 150;

  const loop = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(1)).current;
  const paw = useRef(new Animated.Value(0)).current;

  // Idle loop: gentle bob when neutral, bouncy jump when happy.
  useEffect(() => {
    loop.setValue(0);
    const anim = Animated.loop(
      Animated.timing(loop, {
        toValue: 1,
        duration: happy ? 900 : 2600,
        easing: happy ? Easing.linear : Easing.inOut(Easing.sin),
        useNativeDriver: nativeDriver,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [happy, loop]);

  // One-shot squash-and-stretch whenever `pulse` changes.
  const firstPulse = useRef(true);
  useEffect(() => {
    if (firstPulse.current) {
      firstPulse.current = false;
      return;
    }
    hop.setValue(0.9);
    Animated.spring(hop, { toValue: 1, friction: 3, tension: 220, useNativeDriver: nativeDriver }).start();
  }, [pulse, hop]);

  useEffect(() => {
    if (!wave) return;
    const anim = Animated.loop(
      Animated.timing(paw, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
    );
    anim.start();
    return () => anim.stop();
  }, [wave, paw]);

  const translateY = happy
    ? loop.interpolate({
        inputRange: [0, 0.15, 0.3, 0.45, 0.6, 1],
        outputRange: [0, -14 * scale, -22 * scale, -10 * scale, 0, 0],
      })
    : loop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -6 * scale, 0] });
  const rotate = happy
    ? loop.interpolate({ inputRange: [0, 0.3, 0.6, 0.8, 1], outputRange: ['0deg', '-6deg', '4deg', '0deg', '0deg'] })
    : '0deg';
  const pawRotate = paw.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: ['0deg', '-18deg', '14deg', '0deg'],
  });

  const leftEye = wave || happy ? 'arc' : 'dot';
  const rightEye = happy ? 'arc' : 'dot';
  const earTilt = happy ? 30 : 18;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={happy ? 'Pipoca comemorando' : wave ? 'Pipoca acenando' : 'Pipoca, o mascote'}
    >
      {shadow && (
        <Svg width={size} height={size} viewBox="0 0 200 200" style={{ position: 'absolute' }}>
          <Ellipse cx={100} cy={188} rx={48} ry={7} fill={INK} opacity={0.08} />
        </Svg>
      )}
      <Animated.View style={{ width: size, height: size, transform: [{ translateY }, { rotate }, { scale: hop }] }}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Ellipse cx={50} cy={88} rx={22} ry={40} fill={EAR} transform={`rotate(${earTilt} 50 88)`} />
          <Ellipse cx={150} cy={88} rx={22} ry={40} fill={EAR} transform={`rotate(${-earTilt} 150 88)`} />
          <Circle cx={100} cy={105} r={62} fill={FUR} />
          <Ellipse cx={100} cy={134} rx={36} ry={26} fill={MUZZLE} />

          <Eye kind={leftEye} cx={78} />
          <Eye kind={rightEye} cx={122} />

          <Circle cx={64} cy={124} r={8} fill={CHEEK} opacity={0.45} />
          <Circle cx={136} cy={124} r={8} fill={CHEEK} opacity={0.45} />
          <Ellipse cx={100} cy={123} rx={10} ry={7} fill={INK} />

          {happy ? (
            <G>
              <Path d="M84 134 Q100 158 116 134Z" fill={INK} />
              <Path d="M92 144 Q100 156 108 144Z" fill={TONGUE} />
            </G>
          ) : (
            <G>
              <Path d="M88 138 Q100 148 112 138" stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />
              <Path d="M95 143 Q100 157 105 143Z" fill={TONGUE} />
            </G>
          )}
        </Svg>

        {wave && (
          <Animated.View
            style={{
              position: 'absolute',
              width: size,
              height: size,
              transformOrigin: `${(150 / 200) * 100}% ${(176 / 200) * 100}%`,
              transform: [{ rotate: pawRotate }],
            }}
          >
            <Svg width={size} height={size} viewBox="0 0 200 200">
              <Ellipse cx={165} cy={160} rx={18} ry={22} fill={FUR} />
              <Circle cx={158} cy={148} r={4} fill="#E39A5C" />
              <Circle cx={168} cy={146} r={4} fill="#E39A5C" />
              <Circle cx={176} cy={152} r={4} fill="#E39A5C" />
            </Svg>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

function Eye({ kind, cx }: { kind: 'dot' | 'arc'; cx: number }) {
  if (kind === 'arc') {
    return (
      <Path d={`M${cx - 8} 102 Q${cx} 92 ${cx + 8} 102`} stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />
    );
  }
  return (
    <G>
      <Circle cx={cx} cy={102} r={9} fill={INK} />
      <Circle cx={cx + 3} cy={99} r={3} fill="#FFFFFF" />
    </G>
  );
}
