import test from 'node:test';
import assert from 'node:assert/strict';
import { extractInlineDataImageAttachmentsForAutoReply } from './idle-listener.js';

test('extractInlineDataImageAttachmentsForAutoReply rewrites data URLs to cid and creates inline attachments', () => {
  const pngData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgQHf4S8AAAAASUVORK5CYII=';
  const html = `<p>Hello</p><img alt="one" src="${pngData}"><img alt="two" src="${pngData}">`;

  const converted = extractInlineDataImageAttachmentsForAutoReply(html, 'admin@inout.email');

  assert.equal(converted.inlineAttachments.length, 1);
  assert.equal(converted.inlineAttachments[0].contentType, 'image/png');
  assert.equal(converted.inlineAttachments[0].contentDisposition, 'inline');
  assert.match(converted.inlineAttachments[0].cid, /^inline-[^@]+@inout\.email$/);
  assert.ok(converted.inlineAttachments[0].content.length > 0);

  const cidRef = `cid:${converted.inlineAttachments[0].cid}`;
  assert.equal(converted.html.includes(`src="${pngData}"`), false);
  assert.equal((converted.html.match(new RegExp(cidRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 2);
});
