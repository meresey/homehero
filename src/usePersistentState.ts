import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function usePersistentState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(key)
      .then(saved => { if (saved) setValue(JSON.parse(saved) as T); })
      .finally(() => setHydrated(true));
  }, [key]);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(key, JSON.stringify(value));
  }, [hydrated, key, value]);

  return [value, setValue, hydrated];
}
