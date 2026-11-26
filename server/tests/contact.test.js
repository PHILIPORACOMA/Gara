import { describe, it, expect } from 'vitest';
import { contactPhoneField, messengerUrlField, profileBody } from '../src/validators/pro.validators.js';
import { contactHref, contactOptions } from '../src/services/contact.service.js';

describe('contact link validation', () => {
  it('accepts Messenger and Facebook links and stores them as https', () => {
    expect(messengerUrlField.parse('m.me/marareyes')).toBe('https://m.me/marareyes');
    expect(messengerUrlField.parse('http://www.facebook.com/marareyes.hair')).toBe('https://www.facebook.com/marareyes.hair');
    expect(messengerUrlField.parse('https://m.facebook.com/marareyes')).toBe('https://m.facebook.com/marareyes');
    expect(messengerUrlField.parse('')).toBeUndefined();
  });

  it('rejects links that are not Messenger or Facebook', () => {
    for (const bad of ['https://evil.example/m.me', 'instagram.com/mara', 'mara', 'javascript:alert(1)']) {
      expect(messengerUrlField.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('accepts Philippine mobile numbers in common spellings and stores +63 format', () => {
    expect(contactPhoneField.parse('0917 123 4567')).toBe('+639171234567');
    expect(contactPhoneField.parse('+63 917-123-4567')).toBe('+639171234567');
    expect(contactPhoneField.parse('639171234567')).toBe('+639171234567');
    expect(contactPhoneField.parse('')).toBeUndefined();
  });

  it('rejects landlines, short numbers and text', () => {
    for (const bad of ['032 123 4567', '0917123', 'call me', '+1 415 555 0100']) {
      expect(contactPhoneField.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('profile form keeps both contact fields', () => {
    const parsed = profileBody.parse({
      displayName: 'Mara', categories: ['HAIR'], areas: ['Cebu City'], serviceMode: 'HOME',
      messengerUrl: 'm.me/mara', contactPhone: '0917 123 4567',
    });
    expect(parsed).toMatchObject({ messengerUrl: 'https://m.me/mara', contactPhone: '+639171234567' });
  });
});

describe('contact buttons', () => {
  const both = { messengerUrl: 'https://m.me/mara', contactPhone: '+639171234567' };

  it('builds the link each button opens', () => {
    expect(contactHref(both, 'MESSENGER')).toBe('https://m.me/mara');
    expect(contactHref(both, 'CALL')).toBe('tel:+639171234567');
    expect(contactHref(both, 'SMS')).toBe('sms:+639171234567');
  });

  it('has no link for a channel the pro did not set up', () => {
    expect(contactHref({ messengerUrl: null, contactPhone: '+639171234567' }, 'MESSENGER')).toBeNull();
    expect(contactHref({ messengerUrl: 'https://m.me/mara', contactPhone: null }, 'CALL')).toBeNull();
  });

  it('tells the public profile which buttons exist without giving away the number', () => {
    expect(contactOptions(both)).toEqual({ messenger: true, call: true, sms: true });
    expect(contactOptions({ messengerUrl: 'https://m.me/mara', contactPhone: null })).toEqual({ messenger: true, call: false, sms: false });
  });
});
