// Profile stat tiles — GET /api/app/jobs/stats. Section-local: the Profile
// screen renders regardless of this hook's state (graceful degradation).

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../lib/api';

export default function useTechStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setError(null);
      setStats(await api('/api/app/jobs/stats'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  return { stats, loading, error, refetch };
}
