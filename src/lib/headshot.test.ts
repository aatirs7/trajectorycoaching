import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isPlaceholderImage, resolveHeadshot, seedHeadshotUrl } from './headshot'

const REAL_PHOTO = 'https://images.example.com/coaches/maya.jpg'
const FAKE_FACE = 'https://i.pravatar.cc/400?u=abc'

describe('resolveHeadshot — the placeholder guardrail', () => {
  it('NEVER renders a generated face on a real coach profile', () => {
    // The whole point. The site tells students every coach is verified against their
    // employer; a stock face on such a profile makes that claim false.
    const r = resolveHeadshot({ headshotUrl: FAKE_FACE, isSeed: false })
    assert.deepEqual(r, { kind: 'initials', reason: 'placeholder-on-real-profile' })
  })

  it('refuses placeholders from every known generator host, not just pravatar', () => {
    for (const url of [
      'https://pravatar.cc/300',
      'https://i.pravatar.cc/400?u=x',
      'https://picsum.photos/seed/x/400/400',
      'https://placehold.co/400',
      'https://www.i.pravatar.cc/400',
    ]) {
      assert.equal(
        resolveHeadshot({ headshotUrl: url, isSeed: false }).kind,
        'initials',
        `${url} must not render on a real profile`,
      )
    }
  })

  it('allows a placeholder ONLY on a seed profile', () => {
    assert.deepEqual(resolveHeadshot({ headshotUrl: FAKE_FACE, isSeed: true }), {
      kind: 'image',
      url: FAKE_FACE,
    })
  })

  it('renders a real coach’s own uploaded photo', () => {
    assert.deepEqual(resolveHeadshot({ headshotUrl: REAL_PHOTO, isSeed: false }), {
      kind: 'image',
      url: REAL_PHOTO,
    })
  })

  it('falls back to initials when no photo is set', () => {
    assert.deepEqual(resolveHeadshot({ headshotUrl: null, isSeed: false }), {
      kind: 'initials',
      reason: 'none-set',
    })
  })

  it('rejects non-https and malformed URLs rather than putting them in an img src', () => {
    for (const url of ['javascript:alert(1)', 'data:image/png;base64,xxx', 'http://x.com/a.jpg', 'not a url']) {
      assert.equal(
        resolveHeadshot({ headshotUrl: url, isSeed: false }).kind,
        'initials',
        `${url} must not reach an img src`,
      )
    }
  })
})

describe('isPlaceholderImage', () => {
  it('does not flag a legitimate host that merely contains a placeholder name', () => {
    // "mypicsum.photos.example.com" is not picsum.photos. Substring matching would be a
    // bug in the other direction: refusing a real coach's real photo.
    assert.equal(isPlaceholderImage('https://mypicsum.photos.example.com/a.jpg'), false)
    assert.equal(isPlaceholderImage('https://images.example.com/pravatar.cc/a.jpg'), false)
  })
})

describe('seedHeadshotUrl', () => {
  it('is deterministic: same coach, same face', () => {
    assert.equal(seedHeadshotUrl('coach-1'), seedHeadshotUrl('coach-1'))
    assert.notEqual(seedHeadshotUrl('coach-1'), seedHeadshotUrl('coach-2'))
  })

  it('produces a URL the guardrail recognises as a placeholder', () => {
    assert.equal(isPlaceholderImage(seedHeadshotUrl('x')), true)
  })
})
