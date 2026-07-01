import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function ScoreHistoryChart({ tests }) {
  const data = tests
    .filter(t => t.completed_at)
    .map(t => ({
      date: new Date(t.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      Total: t.total_scaled_score || undefined,
      'R&W': t.rw_scaled_score || undefined,
      Math: t.math_scaled_score || undefined,
    }));

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
        Complete a test to see your score history
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
        <YAxis domain={[200, 1600]} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
        <Tooltip
          contentStyle={{ border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, boxShadow: 'var(--shadow)' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="Total" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb' }} connectNulls />
        <Line type="monotone" dataKey="R&W" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls strokeDasharray="5 3" />
        <Line type="monotone" dataKey="Math" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls strokeDasharray="5 3" />
      </LineChart>
    </ResponsiveContainer>
  );
}
