'use client'
import { Box } from '@polar-sh/orbit/Box'

import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined'
import { PropsWithChildren, useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

export const ResourceLayout = ({
  title,
  children,
  toc,
}: PropsWithChildren<{
  title: string
  children: React.ReactNode
  toc?: { id: string; title: string }[]
}>) => {
  const scrollToSection = useCallback((id: string) => {
    const section = document.getElementById(id)
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  return (
    <Box display="flex" minHeight="100vh" flexDirection="column">
      {/* Main Content */}
      <Box as="main">
        <Box
          marginHorizontal="auto"
          display="flex"
          width="100%"
          maxWidth="1024px"
          flexDirection="column"
          paddingHorizontal={{
            base: 's',
            md: 'none',
          }}
        >
          {/* Content Card */}
          <Box
            backgroundColor={{
              md: 'background-primary',
            }}
            borderColor="border-primary"
            display="flex"
            flexDirection="column"
            rowGap={{
              base: '2xl',
              md: '3xl',
            }}
            borderRadius="s"
            borderWidth={{
              md: 1,
            }}
            padding={{
              md: '5xl',
            }}
            paddingHorizontal={{
              md: '4xl',
            }}
          >
            {/* Top Section */}
            <Box display="flex" flexDirection="column">
              <Box
                display="flex"
                flexDirection="column"
                rowGap="2xl"
                alignItems={{
                  lg: 'center',
                }}
              >
                <h1 className="text-5xl leading-tight! text-balance md:text-6xl lg:w-2/3 lg:text-center">
                  {title}
                </h1>
              </Box>
            </Box>
            {toc && (
              <Box className="dark:divide-polar-700 divide-y divide-gray-200">
                {toc.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="dark:hover:bg-polar-800 flex w-full cursor-pointer items-center gap-3 p-3 transition-colors duration-200 hover:bg-gray-100"
                  >
                    <ArrowDownwardOutlined fontSize="inherit" />
                    <Box as="span">{item.title}</Box>
                  </button>
                ))}
              </Box>
            )}
            <Box display="flex" flexDirection="column" rowGap="3xl">
              {children}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export const ResourceSection = ({
  id,
  title,
  children,
  className,
}: PropsWithChildren<{
  id: string
  title: string
  className?: string
}>) => {
  return (
    <Box
      as="section"
      display="grid"
      gridTemplateColumns={{
        base: 'repeat(1, minmax(0, 1fr))',
        md: 'repeat(3, minmax(0, 1fr))',
      }}
      gap={{
        base: 'l',
        md: '2xl',
      }}
      id={id}
    >
      <Box
        borderColor="border-primary"
        position="sticky"
        top={0}
        gridColumn="span 1 / span 1"
        display="flex"
        height="fit-content"
        flexDirection="column"
        paddingTop="l"
        borderTopWidth={{
          md: 1,
        }}
        className="text-lg md:text-base"
      >
        <h2>{title}</h2>
      </Box>
      <Box
        className={twMerge(
          'dark:border-polar-700 col-span-2 flex flex-col gap-y-4 border-t border-gray-200 pt-4',
          className,
        )}
      >
        {children}
      </Box>
    </Box>
  )
}
