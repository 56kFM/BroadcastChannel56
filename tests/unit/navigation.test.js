import { describe, expect, it } from 'vitest'
import { pickAdjacentPost } from '../../src/lib/telegram/navigation.js'

const ascendingFixture = [
  { id: '100', title: 'first' },
  { id: '101', title: 'second' },
  { id: '102', title: 'third' },
]

const gappedFixture = [
  { id: '100', title: 'earliest' },
  { id: '103', title: 'middle' },
  { id: '110', title: 'latest' },
]

describe('pickAdjacentPost', () => {
  it('navigates to the next newer post for ascending ids', () => {
    const result = pickAdjacentPost({ posts: ascendingFixture, navigateFrom: '100', direction: 'newer' })

    expect(result.pickedPost?.title).toBe('second')
    expect(result.hasOlder).toBe(true)
    expect(result.hasNewer).toBe(true)
  })

  it('picks the next available newer post when ids are gapped', () => {
    const result = pickAdjacentPost({ posts: gappedFixture, navigateFrom: '101', direction: 'newer' })

    expect(result.pickedPost?.id).toBe('103')
    expect(result.hasOlder).toBe(true)
    expect(result.hasNewer).toBe(true)
  })

  it('navigates to the next older post and reports edges', () => {
    const result = pickAdjacentPost({ posts: gappedFixture, navigateFrom: '200', direction: 'older' })

    expect(result.pickedPost?.id).toBe('110')
    expect(result.hasNewer).toBe(false)
    expect(result.hasOlder).toBe(true)
  })
})
