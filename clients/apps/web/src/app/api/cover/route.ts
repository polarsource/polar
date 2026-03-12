import fs from 'fs'
import { NextResponse } from 'next/server'
import path from 'path'

const DIRS: Record<string, string> = {
  blog: path.join(
    process.cwd(),
    'src/app/(main)/(website)/(landing)/(mdx)/blog/(header)',
  ),
  story: path.join(
    process.cwd(),
    'src/app/(main)/(website)/(landing)/customers/(stories)',
  ),
}

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const slug = searchParams.get('slug')
  const file = searchParams.get('file')

  if (!type || !slug || !file || !(type in DIRS)) {
    return new NextResponse(null, { status: 400 })
  }

  // Prevent path traversal
  if (slug.includes('..') || file.includes('..') || file.includes('/')) {
    return new NextResponse(null, { status: 400 })
  }

  const filePath = path.join(DIRS[type], slug, file)

  if (!fs.existsSync(filePath)) {
    return new NextResponse(null, { status: 404 })
  }

  const ext = path.extname(file).toLowerCase()
  const contentType = MIME[ext] ?? 'application/octet-stream'
  const buffer = fs.readFileSync(filePath)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
