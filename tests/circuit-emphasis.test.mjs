import test from 'node:test';
import assert from 'node:assert/strict';
import {emphasizeProgrammePlaces} from '../tools/circuits.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));

test('programme place names are literal, longest first and never nested', () => {
  const text = 'Le marché de Đồng Xuân, Đồng Xuân et Mã Mây (87). Puis Mã Mây (87).';
  const highlights = ['Đồng Xuân', 'marché de Đồng Xuân', 'Mã Mây (87)', 'Đồng Xuân', '', null];
  assert.equal(
    emphasizeProgrammePlaces(text, highlights, esc),
    'Le <strong>marché de Đồng Xuân</strong>, <strong>Đồng Xuân</strong> et <strong>Mã Mây (87)</strong>. Puis <strong>Mã Mây (87)</strong>.'
  );
  assert.equal(emphasizeProgrammePlaces('A+B [Hanoi]. AAB Hanoi.', ['A+B [Hanoi].'], esc), '<strong>A+B [Hanoi].</strong> AAB Hanoi.');
});

test('place emphasis escapes both highlighted phrases and surrounding untrusted source text', () => {
  assert.equal(
    emphasizeProgrammePlaces('<script>alert("x")</script> & Hanoi <img src=x>', ['Hanoi', '<img src=x>'], esc),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; <strong>Hanoi</strong> <strong>&lt;img src=x&gt;</strong>'
  );
});

test('missing or unmatched place names preserve the original escaped prose', () => {
  const text = 'À Hanoi & au <strong>café</strong>, l’itinéraire reste le même.';
  for (const highlights of [undefined, null, [], ['Absent'], 'Hanoi']) {
    assert.equal(emphasizeProgrammePlaces(text, highlights, esc), esc(text));
  }
});
