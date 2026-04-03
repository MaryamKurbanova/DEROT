import { StyleSheet, View } from 'react-native';
import { BrandAppIcon, type BrandAppId } from './BrandAppIcon';

const ID_MAP: Record<string, BrandAppId> = {
  tiktok: 'tiktok',
  instagram: 'instagram',
  youtube: 'youtube',
  snapchat: 'snapchat',
  facebook: 'facebook',
};

type Props = {
  appId: string;
  size: number;
  /** Muted / “off air” — 50% opacity (industrial greyed look). */
  muted?: boolean;
};

export function MonitoredAppIcon({ appId, size, muted = false }: Props) {
  const brand = ID_MAP[appId];
  return (
    <View style={[styles.wrap, { width: size, height: size, opacity: muted ? 0.5 : 1 }]}>
      {brand ? (
        <BrandAppIcon name={brand} size={size} />
      ) : (
        <View style={[styles.fallback, { width: size, height: size }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
});
