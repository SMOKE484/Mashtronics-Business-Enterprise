// Technician's completed jobs — GET /api/app/jobs/history.

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../lib/api';

export default function useJobHistory() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setError(null);
      const list = await api('/api/app/jobs/history');
      setJobs(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  return { jobs, loading, error, refetch };
}
