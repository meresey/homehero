import { HomeHeroApp } from '@/HomeHeroApp';
import { PasswordRecoveryScreen } from '@/AuthFlow';
import { usePasswordRecovery } from '@/lib/passwordRecovery';

export default function Index() {
  const recovery = usePasswordRecovery();
  return recovery === 'idle' ? <HomeHeroApp /> : <PasswordRecoveryScreen state={recovery} />;
}
