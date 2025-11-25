import { ParsedMetricsResponse } from '@/hooks/queries/metrics'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import domtoimage from 'dom-to-image'
import { useCallback, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import LogoType from '../Brand/LogoType'
import { toast } from '../Toast/use-toast'
import MetricChartBox from './MetricChartBox'

interface ShareChartModalProps {
  metric: keyof schemas['Metrics']
  interval: schemas['TimeInterval']
  data: ParsedMetricsResponse
  previousData?: ParsedMetricsResponse
}

export const ShareChartModal = ({
  metric,
  interval,
  data,
  previousData,
}: ShareChartModalProps) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<MetricTheme>('mono')

  const getParams = useCallback(() => {
    const scale = 3

    if (!chartRef.current) return null

    const style = {
      transform: 'scale(' + scale + ')',
      transformOrigin: 'top left',
      width: chartRef.current.offsetWidth + 'px',
      height: chartRef.current.offsetHeight + 'px',
      borderRadius: '0px',
      border: 'none',
    }

    const params = {
      height: chartRef.current.offsetHeight * scale,
      width: chartRef.current.offsetWidth * scale,
      quality: 1,
      style,
    }

    return params
  }, [])

  const downloadImage = useCallback(() => {
    const params = getParams()

    if (!params || !chartRef.current) return

    domtoimage.toBlob(chartRef.current, params).then((blob) => {
      if (!blob) return

      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'polar-chart.png'
      link.click()

      toast({
        title: 'Downloaded Image',
        description: 'Chart image downloaded',
      })
    })
  }, [])

  const copyToClipboard = useCallback(() => {
    const params = getParams()

    if (!chartRef.current || !params) return

    domtoimage.toBlob(chartRef.current, params).then((blob) => {
      if (!blob) return

      navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ])

      toast({
        title: 'Copied to Clipboard',
        description: 'Chart image copied to clipboard',
      })
    })
  }, [getParams])

  return (
    <div className="relative flex w-full max-w-4xl flex-col items-center justify-center overflow-y-auto p-16">
      <div className="flex flex-col items-start gap-8">
        <div
          ref={chartRef}
          className="dark:bg-polar-950 flex w-full max-w-4xl flex-col items-center justify-center gap-12 rounded-4xl bg-blue-50 p-12"
          style={{
            backgroundImage:
              theme === 'mono'
                ? 'url(/assets/share/share_mono.jpg)'
                : 'url(/assets/share/share.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <MetricChartBox
            className="dark:border-polar-600/50"
            data={data}
            previousData={previousData}
            interval={interval}
            metric={metric}
            shareable={false}
            height={200}
            width={560}
            simple
            chartType="line"
          />
          <LogoType className="text-white dark:text-white" height={48} />
        </div>
        <div className="flex w-full flex-row items-center justify-between gap-6">
          <div className="flex flex-row gap-4">
            <MetricThemeSelector
              name="Monochrome"
              slug="mono"
              selected={theme === 'mono'}
              onClick={setTheme}
            />
            <MetricThemeSelector
              name="Color"
              slug="color"
              selected={theme === 'color'}
              onClick={setTheme}
            />
          </div>
          <div className="flex flex-row gap-2">
            <Button fullWidth variant="ghost" onClick={copyToClipboard}>
              Copy
            </Button>
            <Button fullWidth onClick={downloadImage}>
              Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

type MetricTheme = 'mono' | 'color'

interface MetricThemeSelectorProps {
  name: string
  slug: MetricTheme
  selected: boolean
  onClick: (slug: MetricTheme) => void
}

const MetricThemeSelector = ({
  name,
  slug,
  selected,
  onClick,
}: MetricThemeSelectorProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onClick={() => {
            onClick(slug)
          }}
          className={twMerge(
            'h-8 w-8 cursor-pointer rounded-full border-2 transition-opacity hover:opacity-50',
            selected ? 'border-blue-400 dark:border-blue-500' : '',
          )}
          style={{
            backgroundImage:
              slug === 'mono'
                ? 'url(/assets/share/share_mono.jpg)'
                : 'url(/assets/share/share.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </TooltipTrigger>
      <TooltipContent>
        <span className="text-sm">{name}</span>
      </TooltipContent>
    </Tooltip>
  )
}
