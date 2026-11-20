import Badge from './Badge.jsx';
import { BOOKING_STATUS } from '../lib/labels.js';

export default function StatusBadge({ status }) {
  const s = BOOKING_STATUS[status] ?? { label: status, tone: 'neutral' };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
