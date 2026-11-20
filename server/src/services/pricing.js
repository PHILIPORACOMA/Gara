// Pricing, deposit and commission math. Pure functions: no database, easy to test.
// All arithmetic is done in integer centavos (see utils/money.js) and returned in pesos.
import { fromCentavos, percentOfCentavos, toCentavos } from '../utils/money.js';

// What the customer sees BEFORE confirming a booking:
//   subtotal (services) + travel fee (home service only) = total
//   deposit = depositPct% of the total, paid now by GCash
//   balance = total - deposit, paid to the professional on the day
export function calculatePricing({ servicePrices, travelFee = 0, mode, depositPct }) {
  const subtotal = servicePrices.reduce((sum, price) => sum + toCentavos(price), 0);
  const travel = mode === 'HOME' ? toCentavos(travelFee) : 0;
  const total = subtotal + travel;
  const deposit = Math.min(total, percentOfCentavos(total, depositPct));
  const balance = total - deposit;

  return {
    subtotal: fromCentavos(subtotal),
    travelFee: fromCentavos(travel),
    total: fromCentavos(total),
    depositPct: Number(depositPct),
    depositAmount: fromCentavos(deposit),
    balanceDue: fromCentavos(balance),
  };
}

// Recorded when a booking is COMPLETED:
//   gross            = services only (the travel fee is NOT commissioned)
//   commissionAmount = commissionPct% of gross  (Gara's revenue)
//   proNet           = gross - commission + travel fee (the travel fee goes 100% to the pro)
export function calculateEarning({ subtotal, travelFee = 0, commissionPct }) {
  const gross = toCentavos(subtotal);
  const travel = toCentavos(travelFee);
  const commission = percentOfCentavos(gross, commissionPct);

  return {
    gross: fromCentavos(gross),
    commissionPct: Number(commissionPct),
    commissionAmount: fromCentavos(commission),
    travelFee: fromCentavos(travel),
    proNet: fromCentavos(gross - commission + travel),
  };
}
