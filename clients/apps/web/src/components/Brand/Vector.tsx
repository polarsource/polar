'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type PathCommand =
	| { type: 'M'; x: number; y: number }
	| { type: 'L'; x: number; y: number }
	| {
			type: 'C'
			x1: number
			y1: number
			x2: number
			y2: number
			x: number
			y: number
	  }
	| { type: 'Q'; x1: number; y1: number; x: number; y: number }
	| { type: 'Z' }

interface ParsedPath {
	commands: PathCommand[]
	attrs: Record<string, string>
}

interface DragState {
	pathIndex: number
	commandIndex: number
	field: 'anchor' | 'cp1' | 'cp2'
	startX: number
	startY: number
	origX: number
	origY: number
}

interface VectorProps {
	svg: string
	width?: number
	height?: number
	className?: string
	onChange?: (svg: string) => void
}

// --- Parsing ---

function parseNumber(tokens: string[], i: number): [number, number] {
	return [parseFloat(tokens[i]), i + 1]
}

function parseDAttribute(d: string): PathCommand[] {
	const commands: PathCommand[] = []
	// Tokenize: split on command letters and commas/whitespace, keeping command letters
	const raw = d.match(/[a-zA-Z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)
	if (!raw) return commands

	let i = 0
	let curX = 0
	let curY = 0
	let cmd = ''

	while (i < raw.length) {
		if (/^[a-zA-Z]$/.test(raw[i])) {
			cmd = raw[i]
			i++
		}

		const isRelative = cmd === cmd.toLowerCase()
		const baseX = isRelative ? curX : 0
		const baseY = isRelative ? curY : 0
		const upper = cmd.toUpperCase()

		if (upper === 'M') {
			let x: number, y: number
			;[x, i] = parseNumber(raw, i)
			;[y, i] = parseNumber(raw, i)
			x += baseX
			y += baseY
			commands.push({ type: 'M', x, y })
			curX = x
			curY = y
			// Subsequent coordinates after M are treated as L
			cmd = isRelative ? 'l' : 'L'
		} else if (upper === 'L') {
			let x: number, y: number
			;[x, i] = parseNumber(raw, i)
			;[y, i] = parseNumber(raw, i)
			x += baseX
			y += baseY
			commands.push({ type: 'L', x, y })
			curX = x
			curY = y
		} else if (upper === 'C') {
			let x1: number, y1: number, x2: number, y2: number, x: number, y: number
			;[x1, i] = parseNumber(raw, i)
			;[y1, i] = parseNumber(raw, i)
			;[x2, i] = parseNumber(raw, i)
			;[y2, i] = parseNumber(raw, i)
			;[x, i] = parseNumber(raw, i)
			;[y, i] = parseNumber(raw, i)
			commands.push({
				type: 'C',
				x1: x1 + baseX,
				y1: y1 + baseY,
				x2: x2 + baseX,
				y2: y2 + baseY,
				x: x + baseX,
				y: y + baseY,
			})
			curX = x + baseX
			curY = y + baseY
		} else if (upper === 'Q') {
			let x1: number, y1: number, x: number, y: number
			;[x1, i] = parseNumber(raw, i)
			;[y1, i] = parseNumber(raw, i)
			;[x, i] = parseNumber(raw, i)
			;[y, i] = parseNumber(raw, i)
			commands.push({
				type: 'Q',
				x1: x1 + baseX,
				y1: y1 + baseY,
				x: x + baseX,
				y: y + baseY,
			})
			curX = x + baseX
			curY = y + baseY
		} else if (upper === 'Z') {
			commands.push({ type: 'Z' })
		} else if (upper === 'H') {
			let x: number
			;[x, i] = parseNumber(raw, i)
			x += baseX
			commands.push({ type: 'L', x, y: curY })
			curX = x
		} else if (upper === 'V') {
			let y: number
			;[y, i] = parseNumber(raw, i)
			y += baseY
			commands.push({ type: 'L', x: curX, y })
			curY = y
		} else {
			// Unknown command, skip token
			i++
		}
	}

	return commands
}

function parseSVG(svgString: string): { paths: ParsedPath[]; viewBox: string } {
	const parser = new DOMParser()
	const doc = parser.parseFromString(svgString, 'image/svg+xml')
	const svgEl = doc.querySelector('svg')
	const viewBox = svgEl?.getAttribute('viewBox') ?? '0 0 100 100'

	const pathEls = doc.querySelectorAll('path')
	const paths: ParsedPath[] = []

	pathEls.forEach((el) => {
		const d = el.getAttribute('d')
		if (!d) return

		const attrs: Record<string, string> = {}
		for (const attr of Array.from(el.attributes)) {
			if (attr.name !== 'd') {
				attrs[attr.name] = attr.value
			}
		}

		paths.push({ commands: parseDAttribute(d), attrs })
	})

	return { paths, viewBox }
}

// --- Serialization ---

function serializeCommands(commands: PathCommand[]): string {
	return commands
		.map((cmd) => {
			switch (cmd.type) {
				case 'M':
					return `M ${cmd.x} ${cmd.y}`
				case 'L':
					return `L ${cmd.x} ${cmd.y}`
				case 'C':
					return `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`
				case 'Q':
					return `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y}`
				case 'Z':
					return 'Z'
			}
		})
		.join(' ')
}

function serializeToSVG(
	paths: ParsedPath[],
	viewBox: string,
	originalSvg: string,
): string {
	const parser = new DOMParser()
	const doc = parser.parseFromString(originalSvg, 'image/svg+xml')
	const pathEls = doc.querySelectorAll('path')

	pathEls.forEach((el, idx) => {
		if (idx < paths.length) {
			el.setAttribute('d', serializeCommands(paths[idx].commands))
		}
	})

	const svgEl = doc.querySelector('svg')
	return svgEl ? svgEl.outerHTML : originalSvg
}

// --- Component ---

export function Vector({
	svg,
	width,
	height,
	className,
	onChange,
}: VectorProps) {
	const svgRef = useRef<SVGSVGElement>(null)
	const [paths, setPaths] = useState<ParsedPath[]>([])
	const [viewBox, setViewBox] = useState('0 0 100 100')
	const [dragging, setDragging] = useState<DragState | null>(null)
	const [selected, setSelected] = useState<{
		pathIndex: number
		commandIndex: number
	} | null>(null)

	useEffect(() => {
		const { paths: parsed, viewBox: vb } = parseSVG(svg)
		setPaths(parsed)
		setViewBox(vb)
	}, [svg])

	const getSVGPoint = useCallback(
		(clientX: number, clientY: number): { x: number; y: number } => {
			const el = svgRef.current
			if (!el) return { x: 0, y: 0 }
			const pt = el.createSVGPoint()
			pt.x = clientX
			pt.y = clientY
			const ctm = el.getScreenCTM()
			if (!ctm) return { x: 0, y: 0 }
			const svgPt = pt.matrixTransform(ctm.inverse())
			return { x: svgPt.x, y: svgPt.y }
		},
		[],
	)

	const handleMouseDown = useCallback(
		(
			e: React.MouseEvent,
			pathIndex: number,
			commandIndex: number,
			field: 'anchor' | 'cp1' | 'cp2',
		) => {
			e.preventDefault()
			e.stopPropagation()
			setSelected({ pathIndex, commandIndex })
			const pt = getSVGPoint(e.clientX, e.clientY)
			const cmd = paths[pathIndex].commands[commandIndex]

			let origX = 0
			let origY = 0
			if (field === 'anchor' && cmd.type !== 'Z') {
				origX = cmd.x
				origY = cmd.y
			} else if (field === 'cp1' && (cmd.type === 'C' || cmd.type === 'Q')) {
				origX = cmd.x1
				origY = cmd.y1
			} else if (field === 'cp2' && cmd.type === 'C') {
				origX = cmd.x2
				origY = cmd.y2
			}

			setDragging({
				pathIndex,
				commandIndex,
				field,
				startX: pt.x,
				startY: pt.y,
				origX,
				origY,
			})
		},
		[getSVGPoint, paths],
	)

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!dragging) return
			const pt = getSVGPoint(e.clientX, e.clientY)
			const dx = pt.x - dragging.startX
			const dy = pt.y - dragging.startY

			setPaths((prev) => {
				const next = prev.map((p) => ({
					...p,
					commands: [...p.commands],
				}))
				const cmd = { ...next[dragging.pathIndex].commands[dragging.commandIndex] }
				const newX = dragging.origX + dx
				const newY = dragging.origY + dy

				if (dragging.field === 'anchor' && cmd.type !== 'Z') {
					cmd.x = newX
					cmd.y = newY
				} else if (
					dragging.field === 'cp1' &&
					(cmd.type === 'C' || cmd.type === 'Q')
				) {
					cmd.x1 = newX
					cmd.y1 = newY
				} else if (dragging.field === 'cp2' && cmd.type === 'C') {
					cmd.x2 = newX
					cmd.y2 = newY
				}

				next[dragging.pathIndex].commands[dragging.commandIndex] = cmd
				return next
			})
		},
		[dragging, getSVGPoint],
	)

	const handleMouseUp = useCallback(() => {
		if (dragging) {
			setDragging(null)
			onChange?.(serializeToSVG(paths, viewBox, svg))
		}
	}, [dragging, onChange, paths, viewBox, svg])

	// Detect dark mode
	const [isDark, setIsDark] = useState(false)
	useEffect(() => {
		const mq = window.matchMedia('(prefers-color-scheme: dark)')
		setIsDark(document.documentElement.classList.contains('dark') || mq.matches)
		const onClassChange = () => {
			setIsDark(
				document.documentElement.classList.contains('dark') || mq.matches,
			)
		}
		const observer = new MutationObserver(onClassChange)
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class'],
		})
		mq.addEventListener('change', onClassChange)
		return () => {
			observer.disconnect()
			mq.removeEventListener('change', onClassChange)
		}
	}, [])

	const handleStroke = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'
	const handleFill = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)'
	const guideStroke = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'

	// Compute handle sizes relative to viewBox
	const vbParts = viewBox.split(/\s+/).map(Number)
	const vbSize = Math.max(vbParts[2] ?? 100, vbParts[3] ?? 100)
	const anchorSize = vbSize * 0.025
	const anchorHalf = anchorSize / 2
	const cpRadius = vbSize * 0.018
	const strokeW = vbSize * 0.005
	const dashLen = vbSize * 0.015

	// Anchor points for all vertices (always visible)
	const anchors = useMemo(() => {
		const elements: React.ReactElement[] = []
		paths.forEach((path, pi) => {
			path.commands.forEach((cmd, ci) => {
				if (cmd.type === 'Z') return
				elements.push(
					<rect
						key={`a-${pi}-${ci}`}
						x={cmd.x - anchorHalf}
						y={cmd.y - anchorHalf}
						width={anchorSize}
						height={anchorSize}
						fill={handleFill}
						stroke={handleStroke}
						strokeWidth={strokeW}
						onMouseDown={(e) => handleMouseDown(e, pi, ci, 'anchor')}
					/>,
				)
			})
		})
		return elements
	}, [paths, handleMouseDown, anchorSize, anchorHalf, strokeW, handleStroke, handleFill])

	// Control point handles for the selected vertex only
	const controlHandles = useMemo(() => {
		if (!selected) return null

		const { pathIndex: pi, commandIndex: ci } = selected
		const path = paths[pi]
		if (!path) return null
		const cmd = path.commands[ci]
		if (!cmd || cmd.type === 'Z') return null

		// Find previous endpoint for guide lines
		let prevX = 0
		let prevY = 0
		for (let i = 0; i < ci; i++) {
			const c = path.commands[i]
			if (c.type !== 'Z') {
				prevX = c.x
				prevY = c.y
			}
		}

		const elements: React.ReactElement[] = []

		if (cmd.type === 'C') {
			elements.push(
				<line
					key={`g1-${pi}-${ci}`}
					x1={prevX}
					y1={prevY}
					x2={cmd.x1}
					y2={cmd.y1}
					stroke={guideStroke}
					strokeWidth={strokeW * 0.5}
					strokeDasharray={`${dashLen} ${dashLen}`}
					pointerEvents="none"
				/>,
				<line
					key={`g2-${pi}-${ci}`}
					x1={cmd.x2}
					y1={cmd.y2}
					x2={cmd.x}
					y2={cmd.y}
					stroke={guideStroke}
					strokeWidth={strokeW * 0.5}
					strokeDasharray={`${dashLen} ${dashLen}`}
					pointerEvents="none"
				/>,
				<circle
					key={`cp1-${pi}-${ci}`}
					cx={cmd.x1}
					cy={cmd.y1}
					r={cpRadius}
					fill={handleFill}
					stroke={handleStroke}
					strokeWidth={strokeW}
					onMouseDown={(e) => handleMouseDown(e, pi, ci, 'cp1')}
				/>,
				<circle
					key={`cp2-${pi}-${ci}`}
					cx={cmd.x2}
					cy={cmd.y2}
					r={cpRadius}
					fill={handleFill}
					stroke={handleStroke}
					strokeWidth={strokeW}
					onMouseDown={(e) => handleMouseDown(e, pi, ci, 'cp2')}
				/>,
			)
		} else if (cmd.type === 'Q') {
			elements.push(
				<line
					key={`g1-${pi}-${ci}`}
					x1={prevX}
					y1={prevY}
					x2={cmd.x1}
					y2={cmd.y1}
					stroke={guideStroke}
					strokeWidth={strokeW * 0.5}
					strokeDasharray={`${dashLen} ${dashLen}`}
					pointerEvents="none"
				/>,
				<line
					key={`g2-${pi}-${ci}`}
					x1={cmd.x1}
					y1={cmd.y1}
					x2={cmd.x}
					y2={cmd.y}
					stroke={guideStroke}
					strokeWidth={strokeW * 0.5}
					strokeDasharray={`${dashLen} ${dashLen}`}
					pointerEvents="none"
				/>,
				<circle
					key={`cp1-${pi}-${ci}`}
					cx={cmd.x1}
					cy={cmd.y1}
					r={cpRadius}
					fill={handleFill}
					stroke={handleStroke}
					strokeWidth={strokeW}
					onMouseDown={(e) => handleMouseDown(e, pi, ci, 'cp1')}
				/>,
			)
		}

		return elements.length > 0 ? elements : null
	}, [paths, selected, handleMouseDown, cpRadius, strokeW, dashLen, handleStroke, handleFill, guideStroke])

	// Hit-test click on SVG background to select nearest anchor, or deselect
	const handleSvgClick = useCallback(
		(e: React.MouseEvent) => {
			if (dragging) return
			const pt = getSVGPoint(e.clientX, e.clientY)
			const threshold = vbSize * 0.05

			let bestPi = -1
			let bestCi = -1
			let bestDist = threshold
			paths.forEach((path, pi) => {
				path.commands.forEach((cmd, ci) => {
					if (cmd.type === 'Z') return
					const dx = cmd.x - pt.x
					const dy = cmd.y - pt.y
					const dist = Math.sqrt(dx * dx + dy * dy)
					if (dist < bestDist) {
						bestPi = pi
						bestCi = ci
						bestDist = dist
					}
				})
			})

			if (bestPi >= 0) {
				setSelected({ pathIndex: bestPi, commandIndex: bestCi })
			} else {
				setSelected(null)
			}
		},
		[dragging, getSVGPoint, paths, vbSize],
	)

	return (
		<svg
			ref={svgRef}
			viewBox={viewBox}
			width={width}
			height={height}
			className={className}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
			onClick={handleSvgClick}
		>
			{paths.map((path, i) => (
				<path
					key={i}
					d={serializeCommands(path.commands)}
					{...path.attrs}
				/>
			))}
			{controlHandles}
			{anchors}
		</svg>
	)
}
