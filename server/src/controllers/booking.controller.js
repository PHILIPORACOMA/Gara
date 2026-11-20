import * as bookingService from '../services/booking.service.js';
import * as workflow from '../services/bookingWorkflow.service.js';
import * as proBookings from '../services/proBookings.service.js';
import * as adminBookings from '../services/adminBookings.service.js';
import * as reviewService from '../services/review.service.js';

// ---------------------------------------------------------------- customer
export async function quote(req, res) {
  res.json({ quote: await bookingService.quoteBooking(req.valid.body) });
}

export async function create(req, res) {
  res.status(201).json({ booking: await bookingService.createBooking(req.user.id, req.valid.body) });
}

export async function listMine(req, res) {
  res.json(await bookingService.listCustomerBookings(req.user.id, req.valid.query.tab));
}

export async function getOne(req, res) {
  res.json({ booking: await bookingService.getBookingForViewer(req.user, req.valid.params.id) });
}

export async function submitDeposit(req, res) {
  const booking = await bookingService.submitDeposit(req.user.id, req.valid.params.id, req.valid.body, req.file);
  res.json({ booking });
}

export async function review(req, res) {
  res.status(201).json({ review: await reviewService.createReview(req.user.id, req.valid.params.id, req.valid.body) });
}

export async function cancel(req, res) {
  res.json({ booking: await bookingService.cancelBooking(req.user.id, req.valid.params.id) });
}

// ---------------------------------------------------------------- professional
export async function proList(req, res) {
  res.json(await proBookings.listProBookings(req.user.id, req.valid.query.tab));
}

export async function proCalendar(req, res) {
  res.json(await proBookings.getCalendar(req.user.id, req.valid.query.month));
}

export async function proDashboard(req, res) {
  res.json(await proBookings.getDashboard(req.user.id));
}

export async function proEarnings(req, res) {
  res.json(await proBookings.getEarnings(req.user.id, req.valid.query));
}

export async function accept(req, res) {
  res.json({ booking: await workflow.acceptBooking(req.user.id, req.valid.params.id) });
}

export async function decline(req, res) {
  res.json({ booking: await workflow.declineBooking(req.user.id, req.valid.params.id, req.valid.body.reason) });
}

export async function complete(req, res) {
  res.json({ booking: await workflow.completeBooking(req.user.id, req.valid.params.id) });
}

export async function noShow(req, res) {
  res.json({ booking: await workflow.markNoShow(req.user.id, req.valid.params.id) });
}

// ---------------------------------------------------------------- admin
export async function adminDeposits(req, res) {
  res.json({ bookings: await workflow.listDepositQueue() });
}

export async function adminVerifyDeposit(req, res) {
  res.json({ booking: await workflow.verifyDeposit(req.user.id, req.valid.params.id) });
}

export async function adminRejectDeposit(req, res) {
  res.json({ booking: await workflow.rejectDeposit(req.user.id, req.valid.params.id, req.valid.body.note) });
}

export async function adminBookingsList(req, res) {
  res.json(await adminBookings.listAdminBookings(req.valid.query));
}

export async function adminRefundResolved(req, res) {
  res.json({ booking: await workflow.resolveRefund(req.valid.params.id) });
}
