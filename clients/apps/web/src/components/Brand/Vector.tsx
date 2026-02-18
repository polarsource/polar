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
	// Set of "pi:ci" keys for multi-selected vertices
	const [selection, setSelection] = useState<Set<string>>(new Set())
	const selectionRef = useRef<Set<string>>(selection)
	selectionRef.current = selection
	// The last-clicked vertex, used to show control handles
	const [focused, setFocused] = useState<{
		pathIndex: number
		commandIndex: number
	} | null>(null)
	// Marquee drag-select
	const [marquee, setMarquee] = useState<{
		startX: number
		startY: number
		currentX: number
		currentY: number
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
			if (field === 'anchor') {
				const key = `${pathIndex}:${commandIndex}`
				if (e.shiftKey) {
					setSelection((prev) => {
						const next = new Set(prev)
						if (next.has(key)) {
							next.delete(key)
						} else {
							next.add(key)
						}
						return next
					})
				} else if (!selectionRef.current.has(key)) {
					// Only reset selection if clicking an unselected vertex
					setSelection(new Set([key]))
				}
				setFocused({ pathIndex, commandIndex })
			}
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

	const skipNextClick = useRef(false)
	const draggingRef = useRef(dragging)
	draggingRef.current = dragging
	const marqueeRef = useRef(marquee)
	marqueeRef.current = marquee
	const pathsRef = useRef(paths)
	pathsRef.current = paths
	const onChangeRef = useRef(onChange)
	onChangeRef.current = onChange

	// Window-level mousemove/mouseup for drag and marquee so they work outside the SVG
	useEffect(() => {
		const onMouseMove = (e: MouseEvent) => {
			const currentDragging = draggingRef.current
			const currentMarquee = marqueeRef.current

			if (currentMarquee) {
				const pt = getSVGPoint(e.clientX, e.clientY)
				setMarquee((prev) =>
					prev ? { ...prev, currentX: pt.x, currentY: pt.y } : null,
				)
				// Realtime selection update
				const x1 = Math.min(currentMarquee.startX, pt.x)
				const y1 = Math.min(currentMarquee.startY, pt.y)
				const x2 = Math.max(currentMarquee.startX, pt.x)
				const y2 = Math.max(currentMarquee.startY, pt.y)
				const newKeys = new Set<string>()
				pathsRef.current.forEach((path, pi) => {
					path.commands.forEach((cmd, ci) => {
						if (cmd.type === 'Z') return
						if (cmd.x >= x1 && cmd.x <= x2 && cmd.y >= y1 && cmd.y <= y2) {
							newKeys.add(`${pi}:${ci}`)
						}
					})
				})
				setSelection(newKeys)
				return
			}

			if (!currentDragging) return
			const pt = getSVGPoint(e.clientX, e.clientY)
			const dx = pt.x - currentDragging.startX
			const dy = pt.y - currentDragging.startY

			setPaths((prev) => {
				const next = prev.map((p) => ({
					...p,
					commands: [...p.commands],
				}))
				const cmd = { ...next[currentDragging.pathIndex].commands[currentDragging.commandIndex] }
				const newX = currentDragging.origX + dx
				const newY = currentDragging.origY + dy

				if (currentDragging.field === 'anchor' && cmd.type !== 'Z') {
					const adx = newX - cmd.x
					const ady = newY - cmd.y

					const moveVertex = (pi: number, ci: number, tdx: number, tdy: number) => {
						const c = { ...next[pi].commands[ci] }
						if (c.type === 'Z') return
						c.x += tdx
						c.y += tdy
						if (c.type === 'C') {
							c.x2 += tdx
							c.y2 += tdy
						}
						if (c.type === 'Q') {
							c.x1 += tdx
							c.y1 += tdy
						}
						next[pi].commands[ci] = c
						const nci = ci + 1
						if (nci < next[pi].commands.length) {
							const nc = { ...next[pi].commands[nci] }
							if (nc.type === 'C' || nc.type === 'Q') {
								nc.x1 += tdx
								nc.y1 += tdy
								next[pi].commands[nci] = nc
							}
						}
					}

					for (const key of selectionRef.current) {
						const [spi, sci] = key.split(':').map(Number)
						if (spi === currentDragging.pathIndex && sci === currentDragging.commandIndex) continue
						moveVertex(spi, sci, adx, ady)
					}
					moveVertex(currentDragging.pathIndex, currentDragging.commandIndex, adx, ady)
				} else if (
					currentDragging.field === 'cp1' &&
					(cmd.type === 'C' || cmd.type === 'Q')
				) {
					cmd.x1 = newX
					cmd.y1 = newY
					next[currentDragging.pathIndex].commands[currentDragging.commandIndex] = cmd
					const prevCi = currentDragging.commandIndex - 1
					const cmds = next[currentDragging.pathIndex].commands
					if (prevCi >= 0) {
						const prevCmd = { ...cmds[prevCi] }
						if (prevCmd.type === 'C') {
							const ax = prevCmd.x
							const ay = prevCmd.y
							prevCmd.x2 = ax - (newX - ax)
							prevCmd.y2 = ay - (newY - ay)
							cmds[prevCi] = prevCmd
						}
					}
				} else if (currentDragging.field === 'cp2' && cmd.type === 'C') {
					cmd.x2 = newX
					cmd.y2 = newY
					next[currentDragging.pathIndex].commands[currentDragging.commandIndex] = cmd
					const nextCi = currentDragging.commandIndex + 1
					const cmds = next[currentDragging.pathIndex].commands
					if (nextCi < cmds.length) {
						const nextCmd = { ...cmds[nextCi] }
						if (nextCmd.type === 'C' || nextCmd.type === 'Q') {
							const ax = cmd.x
							const ay = cmd.y
							nextCmd.x1 = ax - (newX - ax)
							nextCmd.y1 = ay - (newY - ay)
							cmds[nextCi] = nextCmd
						}
					}
				}

				return next
			})
		}

		const onMouseUp = () => {
			const currentMarquee = marqueeRef.current
			if (currentMarquee) {
				const x1 = Math.min(currentMarquee.startX, currentMarquee.currentX)
				const y1 = Math.min(currentMarquee.startY, currentMarquee.currentY)
				const x2 = Math.max(currentMarquee.startX, currentMarquee.currentX)
				const y2 = Math.max(currentMarquee.startY, currentMarquee.currentY)

				const newKeys = new Set<string>()
				// Read paths from ref to avoid stale closure
				const el = svgRef.current
				if (el) {
					setPaths((currentPaths) => {
						currentPaths.forEach((path, pi) => {
							path.commands.forEach((cmd, ci) => {
								if (cmd.type === 'Z') return
								if (cmd.x >= x1 && cmd.x <= x2 && cmd.y >= y1 && cmd.y <= y2) {
									newKeys.add(`${pi}:${ci}`)
								}
							})
						})
						if (newKeys.size > 0) {
							setSelection((prev) => {
								const next = new Set(prev)
								for (const key of newKeys) next.add(key)
								return next
							})
						}
						return currentPaths // no mutation
					})
				}

				setMarquee(null)
				skipNextClick.current = true
				return
			}

			if (draggingRef.current) {
				skipNextClick.current = true
				setDragging(null)
				onChangeRef.current?.(serializeToSVG(pathsRef.current, viewBox, svg))
			}
		}

		window.addEventListener('mousemove', onMouseMove)
		window.addEventListener('mouseup', onMouseUp)
		return () => {
			window.removeEventListener('mousemove', onMouseMove)
			window.removeEventListener('mouseup', onMouseUp)
		}
	}, [getSVGPoint])

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

	const handleFill = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'
	const guideStroke = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'

	// Compute handle sizes relative to viewBox
	const vbParts = viewBox.split(/\s+/).map(Number)
	const vbSize = Math.max(vbParts[2] ?? 100, vbParts[3] ?? 100)
	const anchorSize = vbSize * 0.015
	const anchorHalf = anchorSize / 2
	const handleSize = vbSize * 0.012
	const handleHalf = handleSize / 2
	const strokeW = vbSize * 0.0025
	const dashLen = vbSize * 0.015

	const selectedFill = isDark ? '#ffffff' : '#000000'

	// Anchor points for all vertices (always visible)
	const anchors = useMemo(() => {
		const elements: React.ReactElement[] = []
		paths.forEach((path, pi) => {
			path.commands.forEach((cmd, ci) => {
				if (cmd.type === 'Z') return
				const isSelected = selection.has(`${pi}:${ci}`)
				elements.push(
					<rect
						key={`a-${pi}-${ci}`}
						x={cmd.x - anchorHalf}
						y={cmd.y - anchorHalf}
						width={anchorSize}
						height={anchorSize}
						fill={isSelected ? selectedFill : 'none'}
						stroke={isSelected ? 'none' : handleFill}
						strokeWidth={isSelected ? 0 : strokeW}
						pointerEvents="all"
						onMouseDown={(e) => handleMouseDown(e, pi, ci, 'anchor')}
					/>,
				)
			})
		})
		return elements
	}, [paths, selection, handleMouseDown, anchorSize, anchorHalf, strokeW, handleFill, selectedFill])

	// Control point handles for the selected vertex only
	// A vertex at command[ci] has:
	//   - incoming handle: cp2 (x2,y2) of command[ci] if it's a C
	//   - outgoing handle: cp1 (x1,y1) of command[ci+1] if it's a C/Q
	// These form a line through the vertex that the user can drag from either side.
	const controlHandles = useMemo(() => {
		if (!focused) return null

		const { pathIndex: pi, commandIndex: ci } = focused
		const path = paths[pi]
		if (!path) return null
		const cmd = path.commands[ci]
		if (!cmd || cmd.type === 'Z') return null

		const anchorX = cmd.x
		const anchorY = cmd.y
		const elements: React.ReactElement[] = []

		// Incoming handle: cp2 of current command
		if (cmd.type === 'C') {
			elements.push(
				<line
					key={`gi-${pi}-${ci}`}
					x1={anchorX}
					y1={anchorY}
					x2={cmd.x2}
					y2={cmd.y2}
					stroke={guideStroke}
					strokeWidth={strokeW * 1.5}
					pointerEvents="none"
				/>,
				<rect
					key={`cpi-${pi}-${ci}`}
					x={cmd.x2 - handleHalf}
					y={cmd.y2 - handleHalf}
					width={handleSize}
					height={handleSize}
					fill={handleFill}
					onMouseDown={(e) => handleMouseDown(e, pi, ci, 'cp2')}
				/>,
			)
		}

		// Outgoing handle: cp1 of next command
		const ni = ci + 1
		const nextCmd = ni < path.commands.length ? path.commands[ni] : null
		if (nextCmd && (nextCmd.type === 'C' || nextCmd.type === 'Q')) {
			elements.push(
				<line
					key={`go-${pi}-${ni}`}
					x1={anchorX}
					y1={anchorY}
					x2={nextCmd.x1}
					y2={nextCmd.y1}
					stroke={guideStroke}
					strokeWidth={strokeW * 1.5}
					pointerEvents="none"
				/>,
				<rect
					key={`cpo-${pi}-${ni}`}
					x={nextCmd.x1 - handleHalf}
					y={nextCmd.y1 - handleHalf}
					width={handleSize}
					height={handleSize}
					fill={handleFill}
					onMouseDown={(e) => handleMouseDown(e, pi, ni, 'cp1')}
				/>,
			)
		}

		return elements.length > 0 ? elements : null
	}, [paths, focused, handleMouseDown, handleSize, handleHalf, strokeW, handleFill, guideStroke])

	// Start marquee on mousedown on empty SVG space
	const handleSvgMouseDown = useCallback(
		(e: React.MouseEvent) => {
			// Only start marquee if clicking on the SVG background (not a handle)
			if ((e.target as Element).tagName !== 'svg') return
			e.preventDefault()
			const pt = getSVGPoint(e.clientX, e.clientY)
			setMarquee({ startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y })
			if (!e.shiftKey) {
				setSelection(new Set())
				setFocused(null)
			}
		},
		[getSVGPoint],
	)

	// Click handler for single vertex selection (only when not marquee dragging)
	const handleSvgClick = useCallback(
		(e: React.MouseEvent) => {
			if (dragging) return
			if (skipNextClick.current) {
				skipNextClick.current = false
				return
			}
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
				const key = `${bestPi}:${bestCi}`
				if (e.shiftKey) {
					setSelection((prev) => {
						const next = new Set(prev)
						if (next.has(key)) {
							next.delete(key)
						} else {
							next.add(key)
						}
						return next
					})
				} else {
					setSelection(new Set([key]))
				}
				setFocused({ pathIndex: bestPi, commandIndex: bestCi })
			} else {
				setSelection(new Set())
				setFocused(null)
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
			onMouseDown={handleSvgMouseDown}


			onClick={handleSvgClick}
		>
			{paths.map((path, i) => (
				<path
					key={i}
					d={serializeCommands(path.commands)}
					{...path.attrs}
					fill={isDark ? '#2a2a2a' : '#e5e5e5'}
				/>
			))}
			{controlHandles}
			{anchors}
			{marquee && (
				<rect
					x={Math.min(marquee.startX, marquee.currentX)}
					y={Math.min(marquee.startY, marquee.currentY)}
					width={Math.abs(marquee.currentX - marquee.startX)}
					height={Math.abs(marquee.currentY - marquee.startY)}
					fill={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
					stroke={guideStroke}
					strokeWidth={strokeW * 0.5}


					pointerEvents="none"
				/>
			)}
		</svg>
	)
}
