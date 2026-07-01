import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

export default function TopicAccuracyChart({ topics, maxItems = 12 }) {
  const data = topics
    .filter(t => t.total >= 2)
    .slice(0, maxItems)
    .map(t => ({
      topic: t.topic.length > 22 ? t.topic.slice(0, 22) + '…' : t.topic,
      fullTopic: t.topic,
      accuracy: t.accuracy,
      total: t.total,
    }));

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
        Answer more questions to see topic accuracy
      </div>
    );
  }

  const getBarColor = (accuracy) => {
    if (accuracy >= 80) return '#10b981';
    if (accuracy >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.625rem 0.875rem', fontSize: 13, boxShadow: 'var(--shadow)' }}>
        <div style={{ fontWeight: 600, marginBottom: 3 }}>{d.fullTopic}</div>
        <div style={{ color: 'var(--text-secondary)' }}>{d.accuracy}% correct ({d.total} attempts)</div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `${v}%`} />
        <YAxis dataKey="topic" type="category" width={150} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((d, i) => (
            <Cell key={i} fill={getBarColor(d.accuracy)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
