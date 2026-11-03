import { ParsedMetricsResponse } from '@/hooks/queries/metrics'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import domtoimage from 'dom-to-image'
import { useEffect, useRef, useState } from 'react'
import LogoType from '../Brand/logos/LogoType'
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
  const containerRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState({ scale: 1, height: 0 })

  useEffect(() => {
    const container = containerRef.current
    const card = chartRef.current

    if (!container || !card) return

    const observer = new ResizeObserver(() => {
      setPreview({
        scale: Math.min(1, container.clientWidth / card.offsetWidth),
        height: card.offsetHeight,
      })
    })

    observer.observe(container)
    observer.observe(card)

    return () => observer.disconnect()
  }, [])

  const isScaled = preview.scale < 1

  const getParams = () => {
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
  }

  const downloadImage = () => {
    const params = getParams()

    if (!params || !chartRef.current) return

    domtoimage.toBlob(chartRef.current, params).then((blob) => {
      if (!blob) return

      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = 'polar-chart.png'
      link.click()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0)

      toast({
        title: 'Downloaded Image',
        description: 'Chart image downloaded',
      })
    })
  }

  const copyToClipboard = () => {
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
  }

  return (
    <div className="relative flex w-full max-w-4xl flex-col items-center justify-center overflow-y-auto p-6 md:p-16">
      <div
        ref={containerRef}
        className="flex flex-col items-start gap-8 max-md:w-full"
      >
        <div
          className="max-md:w-full max-md:overflow-x-clip"
          style={
            isScaled ? { height: preview.height * preview.scale } : undefined
          }
        >
          <div
            ref={chartRef}
            className="dark:bg-polar-950 flex w-full max-w-4xl flex-col items-center justify-center gap-12 rounded-4xl bg-blue-50 p-12 max-md:min-w-[672px]"
            style={{
              backgroundImage:
                'url(/assets/landing/company/Polar_Flow_03_No_Logo.jpg)',
              backgroundSize: 'auto 120%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              transform: isScaled ? `scale(${preview.scale})` : undefined,
              transformOrigin: 'top left',
            }}
          >
            <MetricChartBox
              className="dark:border-polar-600/50 rounded-3xl lg:rounded-3xl"
              chartClassName="rounded-2xl"
              data={data}
              previousData={previousData}
              interval={interval}
              metric={metric}
              shareable={false}
              exportable={false}
              height={200}
              width={560}
              simple
              chartType="line"
            />
            <LogoType className="text-white dark:text-white" height={32} />
          </div>
        </div>
        <div className="flex w-full flex-col items-start gap-4 md:flex-row md:items-center md:justify-end md:gap-6">
          <div className="flex w-full flex-row gap-2 md:w-auto">
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
