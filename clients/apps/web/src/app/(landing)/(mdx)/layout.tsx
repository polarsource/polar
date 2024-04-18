export default function Layout({ children }: { children: React.ReactNode }) {
  // Create any shared layout or styles here
  return (
    <div className="px-6 pb-16 md:px-12">
      <div className="prose prose-headings:mt-16 !prose-headings:font-semibold prose-headings:text-black prose-h1:text-blue-500 prose-h1:text-5xl prose-h2:text-4xl prose-h3:text-3xl prose-h4:text-2xl prose-h5:text-xl prose-h6:text-lg dark:prose-headings:text-white max-w-4xl text-lg text-gray-800">
        {children}
      </div>
    </div>
  )
}
