import { describe, it, expect } from 'vitest';
import { calculateEarning, calculatePricing } from '../src/services/pricing.js';

describe('calculatePricing: price breakdown shown before confirming', () => {
  it('home service: services + travel fee = total, 20% deposit, rest due on the day', () => {
    const p = calculatePricing({ servicePrices: [1800, 650], travelFee: 150, mode: 'HOME', depositPct: 20 });
    expect(p).toEqual({
      subtotal: 2450,
      travelFee: 150,
      total: 2600,
      depositPct: 20,
      depositAmount: 520, // 20% of 2,600 (the travel fee is part of what the customer pays)
      balanceDue: 2080,
    });
  });

  it('in-store: no travel fee even if the pro has one set', () => {
    const p = calculatePricing({ servicePrices: [1800], travelFee: 150, mode: 'STORE', depositPct: 20 });
    expect(p.travelFee).toBe(0);
    expect(p.total).toBe(1800);
    expect(p.depositAmount).toBe(360);
    expect(p.balanceDue).toBe(1440);
  });

  it('deposit + balance always equals the total, even when the percentage does not divide evenly', () => {
    for (const [prices, pct] of [[[333.33], 20], [[199.99, 49.5], 15], [[1], 33.33], [[12345.67], 7.5]]) {
      const p = calculatePricing({ servicePrices: prices, mode: 'STORE', depositPct: pct });
      expect(Math.round((p.depositAmount + p.balanceDue) * 100)).toBe(Math.round(p.total * 100));
    }
  });

  it('rounds the deposit to the nearest centavo', () => {
    // 20% of 333.33 = 66.666 -> 66.67
    expect(calculatePricing({ servicePrices: [333.33], mode: 'STORE', depositPct: 20 }).depositAmount).toBe(66.67);
  });

  it('follows the deposit percentage setting (admin can change it)', () => {
    expect(calculatePricing({ servicePrices: [1000], mode: 'STORE', depositPct: 50 }).depositAmount).toBe(500);
    expect(calculatePricing({ servicePrices: [1000], mode: 'STORE', depositPct: 100 }).balanceDue).toBe(0);
  });

  it('avoids floating point drift (0.1 + 0.2 style errors)', () => {
    const p = calculatePricing({ servicePrices: [0.1, 0.2], mode: 'STORE', depositPct: 20 });
    expect(p.subtotal).toBe(0.3);
    expect(p.total).toBe(0.3);
  });

  it('accepts Prisma-style decimal strings', () => {
    const p = calculatePricing({ servicePrices: ['1800.00', '650.50'], travelFee: '150.00', mode: 'HOME', depositPct: '20.00' });
    expect(p.total).toBe(2600.5);
  });
});

describe('calculateEarning: commission when a booking is completed', () => {
  it('takes 10% of the services only; the travel fee goes 100% to the pro', () => {
    const e = calculateEarning({ subtotal: 2450, travelFee: 150, commissionPct: 10 });
    expect(e).toEqual({
      gross: 2450,
      commissionPct: 10,
      commissionAmount: 245,
      travelFee: 150,
      proNet: 2355, // 2450 - 245 + 150
    });
  });

  it('in-store booking: no travel fee, net is gross minus commission', () => {
    const e = calculateEarning({ subtotal: 1800, travelFee: 0, commissionPct: 10 });
    expect(e.commissionAmount).toBe(180);
    expect(e.proNet).toBe(1620);
  });

  it('commission never touches the travel fee, whatever its size', () => {
    const withTravel = calculateEarning({ subtotal: 1000, travelFee: 500, commissionPct: 10 });
    const without = calculateEarning({ subtotal: 1000, travelFee: 0, commissionPct: 10 });
    expect(withTravel.commissionAmount).toBe(without.commissionAmount);
    expect(withTravel.proNet - without.proNet).toBe(500);
  });

  it('uses the commission rate it is given (the booking keeps the rate agreed at booking time)', () => {
    expect(calculateEarning({ subtotal: 2000, commissionPct: 15 }).commissionAmount).toBe(300);
    expect(calculateEarning({ subtotal: 2000, commissionPct: 0 }).proNet).toBe(2000);
  });

  it('rounds commission to the nearest centavo and keeps the books balanced', () => {
    const e = calculateEarning({ subtotal: 333.33, travelFee: 0, commissionPct: 10 });
    expect(e.commissionAmount).toBe(33.33);
    expect(Math.round((e.commissionAmount + e.proNet) * 100)).toBe(Math.round(e.gross * 100));
  });
});
