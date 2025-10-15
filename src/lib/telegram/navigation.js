export function toNumericId(value) {
  if (value === null || value === undefined) {
    return Number.NaN
  }

  const text = String(value).trim()
  if (!text) {
    return Number.NaN
  }

  const parsed = Number.parseInt(text, 10)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function pickAdjacentPost({ posts, navigateFrom, direction }) {
  const sortedPosts = Array.isArray(posts) ? posts : []
  const hint = direction === 'older' ? 'older' : direction === 'newer' ? 'newer' : ''
  if (!hint) {
    return { pickedPost: null, hasNewer: false, hasOlder: false }
  }

  const pivotRaw = toNumericId(navigateFrom)
  const pivot = Number.isFinite(pivotRaw)
    ? pivotRaw
    : hint === 'older'
      ? Number.POSITIVE_INFINITY
      : Number.NEGATIVE_INFINITY

  let pickedPost = null
  if (hint === 'newer') {
    pickedPost = sortedPosts.find((post) => {
      const value = toNumericId(post?.id)
      return Number.isFinite(value) && value > pivot
    }) ?? null
  }
  else {
    for (let index = sortedPosts.length - 1; index >= 0; index -= 1) {
      const candidate = sortedPosts[index]
      const value = toNumericId(candidate?.id)
      if (Number.isFinite(value) && value < pivot) {
        pickedPost = candidate
        break
      }
    }
  }

  const pickedNumeric = toNumericId(pickedPost?.id)
  const hasNewer = pickedPost
    ? sortedPosts.some((post) => {
      const value = toNumericId(post?.id)
      return Number.isFinite(value) && Number.isFinite(pickedNumeric) && value > pickedNumeric
    })
    : false

  const hasOlder = pickedPost
    ? sortedPosts.some((post) => {
      const value = toNumericId(post?.id)
      return Number.isFinite(value) && Number.isFinite(pickedNumeric) && value < pickedNumeric
    })
    : false

  return { pickedPost, hasNewer, hasOlder }
}

export default pickAdjacentPost
