// The booking life cycle in one place. Every status change in the app goes through
// assertTransition(), so an illegal jump (e.g. COMPLETED -> CONFIRMED) cannot happen.
//
//   PENDING_DEPOSIT --customer submits GCash proof--> DEPOSIT_SUBMITTED
//   DEPOSIT_SUBMITTED --admin verifies--> DEPOSIT_VERIFIED
//   DEPOSIT_SUBMITTED --admin rejects--> PENDING_DEPOSIT (customer can try again)
//   DEPOSIT_VERIFIED --pro accepts--> CONFIRMED          --pro declines--> DECLINED (refund needed)
//   CONFIRMED --pro, after the appointment--> COMPLETED | NO_SHOW
//   any active status --customer cancels--> CANCELLED
import { ApiError } from '../utils/ApiError.js';

export const TRANSITIONS = {
  PENDING_DEPOSIT: ['DEPOSIT_SUBMITTED', 'CANCELLED'],
  DEPOSIT_SUBMITTED: ['DEPOSIT_VERIFIED', 'PENDING_DEPOSIT', 'CANCELLED'],
  DEPOSIT_VERIFIED: ['CONFIRMED', 'DECLINED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  DECLINED: [],
  NO_SHOW: [],
};

export const canTransition = (from, to) => TRANSITIONS[from]?.includes(to) ?? false;

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw ApiError.unprocessable(
      `This booking is ${from.toLowerCase().replaceAll('_', ' ')} and cannot move to ${to.toLowerCase().replaceAll('_', ' ')}.`,
      'INVALID_TRANSITION',
      { from, to },
    );
  }
}

// Statuses in which a customer may still cancel.
export const CUSTOMER_CANCELLABLE = ['PENDING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'DEPOSIT_VERIFIED', 'CONFIRMED'];

// "My bookings" tabs. Each tab is a set of statuses.
export const CUSTOMER_TABS = {
  awaiting: ['PENDING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'DEPOSIT_VERIFIED'],
  upcoming: ['CONFIRMED'],
  completed: ['COMPLETED'],
  cancelled: ['CANCELLED', 'DECLINED', 'NO_SHOW'],
};

export const PRO_TABS = {
  requests: ['DEPOSIT_VERIFIED'],
  upcoming: ['CONFIRMED'],
  awaiting: ['PENDING_DEPOSIT', 'DEPOSIT_SUBMITTED'],
  completed: ['COMPLETED'],
  cancelled: ['CANCELLED', 'DECLINED', 'NO_SHOW'],
};
