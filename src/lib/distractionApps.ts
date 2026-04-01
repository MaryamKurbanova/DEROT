export type DistractionApp = {
  id: string;
  label: string;
  /** iOS bundle id or Android package — used when wiring native intercept */
  iosBundleId?: string;
  androidPackage?: string;
};

export const DISTRACTION_APPS: DistractionApp[] = [
  { id: 'tiktok', label: 'TikTok', androidPackage: 'com.zhiliaoapp.musically', iosBundleId: 'com.zhiliaoapp.musically' },
  { id: 'instagram', label: 'Instagram', androidPackage: 'com.instagram.android', iosBundleId: 'com.burbn.instagram' },
  { id: 'youtube', label: 'YouTube', androidPackage: 'com.google.android.youtube', iosBundleId: 'com.google.ios.youtube' },
  { id: 'snapchat', label: 'Snapchat', androidPackage: 'com.snapchat.android', iosBundleId: 'com.toyopagroup.picaboo' },
  { id: 'facebook', label: 'Facebook', androidPackage: 'com.facebook.katana', iosBundleId: 'com.facebook.Facebook' },
];

export function findDistractionById(id: string): DistractionApp | undefined {
  return DISTRACTION_APPS.find((a) => a.id === id);
}
