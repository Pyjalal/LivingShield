import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import type { Station, Language } from './domain';
export default function RainChart({
  stations,
  language,
}: {
  stations: Station[];
  language: Language;
}) {
  const data = [...stations]
    .sort((a, b) => (b.rainfall1h ?? 0) - (a.rainfall1h ?? 0))
    .slice(0, 8)
    .map((s) => ({ name: s.name, rainfall: s.rainfall1h }));
  return (
    <div className="chart">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        initialDimension={{ width: 800, height: 280 }}
      >
        <BarChart data={data} margin={{ bottom: 45, left: 0, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
          <YAxis unit=" mm" />
          <Tooltip />
          <Bar
            name={language === 'ms' ? 'Hujan (mm)' : 'Rainfall (mm)'}
            dataKey="rainfall"
            fill="#167d8d"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
