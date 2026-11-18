import { Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

/** Initial-letter avatar until pet photos exist. */
export function PetAvatar({ name, size = 48 }: { name: string; size?: number }) {
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FFD7BD',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.42, color: colors.ink }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}
