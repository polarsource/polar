import fs from 'fs'
import path from 'path'

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif']

export interface ContentPost {
  slug: string
  title: string
  description: string
  date: string
  image: string | null
  type: 'blog' | 'story'
  href: string
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()
    if (key) result[key] = value
  }
  return result
}

function findCoverImage(dir: string): string | null {
  try {
    const files = fs.readdirSync(dir)
    const img = files.find((f) =>
      IMAGE_EXTS.includes(path.extname(f).toLowerCase()),
    )
    return img ?? null
  } catch {
    return null
  }
}

const BLOG_DIR = path.join(
  process.cwd(),
  'src/app/(main)/(website)/(landing)/(mdx)/blog/(header)/_posts',
)

const STORIES_DIR = path.join(
  process.cwd(),
  'src/app/(main)/(website)/(landing)/customers/(stories)',
)

const PUBLIC_POSTS_DIR = path.join(process.cwd(), 'public/posts')

function readPostsFromDir(
  dir: string,
  type: 'blog' | 'story',
  hrefPrefix: string,
): ContentPost[] {
  return fs
    .readdirSync(dir)
    .filter((name) => {
      const fullPath = path.join(dir, name)
      return (
        fs.statSync(fullPath).isDirectory() &&
        fs.existsSync(path.join(fullPath, 'page.mdx'))
      )
    })
    .map((slug) => {
      const postDir = path.join(dir, slug)
      const content = fs.readFileSync(path.join(postDir, 'page.mdx'), 'utf-8')
      const fm = parseFrontmatter(content)
      const imageFile = findCoverImage(path.join(PUBLIC_POSTS_DIR, type, slug))
      return {
        slug,
        title: fm.title ?? slug,
        description: fm.description ?? '',
        date: fm.created_at ?? '',
        image: imageFile ? `/posts/${type}/${slug}/${imageFile}` : null,
        type,
        href: `${hrefPrefix}/${slug}`,
      }
    })
}

export function getAllContent(): ContentPost[] {
  const blogPosts = readPostsFromDir(BLOG_DIR, 'blog', '/blog')
  const stories = readPostsFromDir(STORIES_DIR, 'story', '/customers')

  return [...blogPosts, ...stories].sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })
}
