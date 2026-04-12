import { useEffect } from 'react';

function Onboarding() {
  useEffect(() => {
    window.location.replace('/dashboard/');
  }, []);
  return null;
}

export default Onboarding;
