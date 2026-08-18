// Camera health — GET /api/app/cameras, refetched every time the screen
// gains focus and on pull-to-refresh.

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../lib/api';

export default function useCameras() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setError(null);
      const list = await api('/api/app/cameras');
      setCameras(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  return { cameras, loading, error, refetch };
}
