const test = require('node:test');
const assert = require('node:assert/strict');

// Unit validation logic mirroring src/app/api/contact/route.ts
function validateContactPayload(body) {
  const { name, email, firmName, role, country, message } = body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return { valid: false, status: 400, error: 'Full name is required.' };
  }

  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    return { valid: false, status: 400, error: 'A valid work email is required.' };
  }

  if (!firmName || typeof firmName !== 'string' || !firmName.trim()) {
    return { valid: false, status: 400, error: 'Firm name is required.' };
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return { valid: false, status: 400, error: 'Please describe your firm’s priorities or goals.' };
  }

  return {
    valid: true,
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      firmName: firmName.trim(),
      role: role ? String(role).trim() : null,
      country: country ? String(country).trim() : null,
      message: message.trim(),
    }
  };
}

test('rejects payload with missing or empty name', () => {
  const res = validateContactPayload({ email: 'test@firm.com', firmName: 'Firm', message: 'Hello' });
  assert.equal(res.valid, false);
  assert.equal(res.status, 400);
  assert.equal(res.error, 'Full name is required.');
});

test('rejects payload with invalid email', () => {
  const res = validateContactPayload({ name: 'Jane', email: 'invalid-email', firmName: 'Firm', message: 'Hello' });
  assert.equal(res.valid, false);
  assert.equal(res.status, 400);
  assert.equal(res.error, 'A valid work email is required.');
});

test('rejects payload with missing firm name', () => {
  const res = validateContactPayload({ name: 'Jane', email: 'jane@firm.com', message: 'Hello' });
  assert.equal(res.valid, false);
  assert.equal(res.status, 400);
  assert.equal(res.error, 'Firm name is required.');
});

test('rejects payload with empty message', () => {
  const res = validateContactPayload({ name: 'Jane', email: 'jane@firm.com', firmName: 'Firm', message: '   ' });
  assert.equal(res.valid, false);
  assert.equal(res.status, 400);
  assert.equal(res.error, 'Please describe your firm’s priorities or goals.');
});

test('accepts valid contact payload and normalizes fields', () => {
  const res = validateContactPayload({
    name: '  Jane Doe  ',
    email: ' JANE.DOE@FIRM.COM ',
    firmName: '  Doe & Partners ',
    role: ' Managing Partner ',
    country: ' United Kingdom ',
    message: ' We need strategic directory advice. '
  });
  assert.equal(res.valid, true);
  assert.equal(res.data.name, 'Jane Doe');
  assert.equal(res.data.email, 'jane.doe@firm.com');
  assert.equal(res.data.firmName, 'Doe & Partners');
  assert.equal(res.data.role, 'Managing Partner');
  assert.equal(res.data.country, 'United Kingdom');
  assert.equal(res.data.message, 'We need strategic directory advice.');
});
