import { Redirect, useLocalSearchParams } from 'expo-router';

/** petapp://convite/CODE opens the join screen with the code filled in. */
export default function InviteLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/family/join', params: { code: code ?? '' } }} />;
}
