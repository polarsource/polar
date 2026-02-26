import { describe, expect, it } from 'vitest'
import { getResizedImage } from './getResizedImage'

const S3_URL =
  'https://polar-public-files.s3.amazonaws.com/product_media/abc/image.png'

describe('getResizedImage', () => {
  it('should return CDN URL with correct width for small thumbnail', () => {
    expect(getResizedImage(S3_URL, 40)).toBe(
      'https://uploads.polar.sh/product_media/abc/image.png?width=96',
    )
  })

  it('should return CDN URL with correct width for medium thumbnail', () => {
    expect(getResizedImage(S3_URL, 70)).toBe(
      'https://uploads.polar.sh/product_media/abc/image.png?width=192',
    )
  })

  it('should return CDN URL with correct width for slideshow', () => {
    expect(getResizedImage(S3_URL, 672)).toBe(
      'https://uploads.polar.sh/product_media/abc/image.png?width=1440',
    )
  })

  it('should snap to the largest size when display width exceeds all sizes', () => {
    expect(getResizedImage(S3_URL, 1000)).toBe(
      'https://uploads.polar.sh/product_media/abc/image.png?width=1920',
    )
  })

  it('should not resize URLs that do not support resizing', () => {
    expect(getResizedImage('https://example.com/image.png', 40)).toBe(
      'https://example.com/image.png',
    )
    expect(getResizedImage('https://cdn.other.com/photo.jpg', 100)).toBe(
      'https://cdn.other.com/photo.jpg',
    )
  })

  it('should not resize local Minio URLs', () => {
    const localUrl = 'http://127.0.0.1:9000/polar-s3-public/media/image.png'
    expect(getResizedImage(localUrl, 40)).toBe(localUrl)
  })

  it('should snap to exact size when retina width matches', () => {
    expect(getResizedImage(S3_URL, 32)).toBe(
      'https://uploads.polar.sh/product_media/abc/image.png?width=64',
    )
  })

  it('should not double-process already-resized CDN URLs', () => {
    const cdnUrl =
      'https://uploads.polar.sh/product_media/abc/image.png?width=96'
    expect(getResizedImage(cdnUrl, 40)).toBe(cdnUrl)
  })

  it('should return empty string for null or undefined', () => {
    expect(getResizedImage(null, 40)).toBe('')
    expect(getResizedImage(undefined, 40)).toBe('')
  })
})
