import { Redirect } from 'expo-router';

import { usePetStore } from '@/store/usePetStore';

export default function Index() {
  const onboarded = usePetStore((s) => s.onboarded);
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding'} />;
}
