import { useEffect, useMemo, useRef } from 'react'
import siteContent from '@/config/site-content.json'
import { makeNoise2D, rand } from './utils'

/**
 * Aurora / Flowing-gradient Background
 * - Several large soft color blobs drift via a Perlin/Simplex flow field
 * - Each blob is a radial gradient (color -> transparent) for an "aurora" look
 * - Designed to sit behind content; a separate blur layer is added in the layout
 * - Includes a CSS gradient fallback so the background is never plain white,
 *   even before the first canvas frame renders.
 */
const FALLBACK_COLORS = ['#8fdbe9', '#f7da39', '#b6a8ff', '#ff9ecd']

function buildGradient(colors: string[]) {
	const palette = colors && colors.length ? colors : FALLBACK_COLORS
	const used = palette.length >= 3 ? palette : [...palette, ...FALLBACK_COLORS]
	const stops = [
		{ x: 15, y: 20, c: used[0], r: 50 },
		{ x: 85, y: 25, c: used[1 % used.length], r: 55 },
		{ x: 70, y: 80, c: used[2 % used.length], r: 55 },
		{ x: 25, y: 75, c: used[3 % used.length] || used[0], r: 45 }
	]
	return stops.map(s => `radial-gradient(circle at ${s.x}% ${s.y}%, ${s.c} 0%, transparent ${s.r}%)`).join(', ')
}

export default function AuroraBackground({
	count = 8,
	colors = siteContent.backgroundColors && siteContent.backgroundColors.length ? siteContent.backgroundColors : FALLBACK_COLORS,
	minRadius = 280,
	maxRadius = 560,
	speed = 0.55,
	noiseScale = 0.0006,
	noiseTimeScale = 0.00025,
	targetFps = 30,
	blur = 10,
	regenerateKey = 0
}) {
	const ref = useRef<HTMLCanvasElement>(null)
	const noise = useRef(makeNoise2D())
	const animRef = useRef(0)
	const fallbackGradient = useMemo(() => buildGradient(colors), [colors])

	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		const context = ctx
		let width = 0
		let height = 0
		const DPR = Math.min(2, window.devicePixelRatio || 1)
		const palette = colors && colors.length ? colors : FALLBACK_COLORS
		const blobs: { x: number; y: number; r: number; color: string; vx: number; vy: number; jitter: number }[] = []

		const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

		function resize() {
			width = canvas!.clientWidth
			height = canvas!.clientHeight
			canvas!.width = Math.floor(width * DPR)
			canvas!.height = Math.floor(height * DPR)
			context.setTransform(1, 0, 0, 1, 0, 0)
			context.scale(DPR, DPR)
		}

		function placeBlobs() {
			blobs.length = 0
			const minDist = Math.max(minRadius * 0.25, 120)
			let tries = 0
			while (blobs.length < count && tries < 5000) {
				tries++
				const r = rand(minRadius, maxRadius)
				const x = rand(0, Math.max(1, width))
				const y = rand(0, Math.max(1, height))
				let ok = true
				for (const b of blobs) {
					if (Math.hypot(b.x - x, b.y - y) < (b.r + r) * 0.5) {
						ok = false
						break
					}
				}
				if (ok) {
					blobs.push({
						x,
						y,
						r,
						color: palette[blobs.length % palette.length],
						vx: 0,
						vy: 0,
						jitter: rand(0.7, 1.3)
					})
				}
			}
		}

		function draw() {
			context.clearRect(0, 0, width, height)
			for (const b of blobs) {
				context.save()
				context.filter = `blur(${blur}px)`
				context.globalAlpha = 1
				const grad = context.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
				grad.addColorStop(0, b.color)
				grad.addColorStop(1, 'rgba(0,0,0,0)')
				context.fillStyle = grad
				context.beginPath()
				context.arc(b.x, b.y, b.r, 0, Math.PI * 2)
				context.fill()
				context.restore()
			}
		}

		function update(t: number) {
			for (const b of blobs) {
				const n = noise.current(b.x * noiseScale, b.y * noiseScale + t * noiseTimeScale)
				const angle = n * Math.PI * 2
				b.x += Math.cos(angle) * speed * b.jitter
				b.y += Math.sin(angle) * speed * b.jitter
				// Wrap around edges for endless drift
				if (b.x < -b.r) b.x = width + b.r
				if (b.x > width + b.r) b.x = -b.r
				if (b.y < -b.r) b.y = height + b.r
				if (b.y > height + b.r) b.y = -b.r
			}
		}

		const FRAME = 1000 / targetFps
		let last = 0
		let acc = 0
		function frame(t: number) {
			if (document.hidden) {
				animRef.current = requestAnimationFrame(frame)
				return
			}
			const dt = last ? t - last : 0
			last = t
			acc += dt
			if (acc < FRAME) {
				animRef.current = requestAnimationFrame(frame)
				return
			}
			acc = 0
			update(t)
			draw()
			animRef.current = requestAnimationFrame(frame)
		}

		function start() {
			resize()
			// If the canvas has no layout size yet, wait for the next frame and retry.
			// This commonly happens during SSR hydration before the browser lays out the element.
			if (width === 0 || height === 0) {
				animRef.current = requestAnimationFrame(start)
				return
			}
			placeBlobs()
			draw()
			if (!reduceMotion) {
				animRef.current = requestAnimationFrame(frame)
			}
		}

		let resizeTimer: number | null = null
		const ro = new ResizeObserver(() => {
			if (resizeTimer !== null) window.clearTimeout(resizeTimer)
			resizeTimer = window.setTimeout(() => {
				resize()
				placeBlobs()
				draw()
			}, 200)
		})
		ro.observe(canvas)

		start()

		return () => {
			cancelAnimationFrame(animRef.current)
			ro.disconnect()
			if (resizeTimer !== null) window.clearTimeout(resizeTimer)
		}
	}, [colors, regenerateKey, count, minRadius, maxRadius, speed, noiseScale, noiseTimeScale, targetFps, blur])

	return (
		<div
			className='fixed inset-0 z-0 overflow-hidden'
			style={{ background: fallbackGradient, backgroundColor: 'transparent' }}>
			<canvas ref={ref} className='h-full w-full' style={{ display: 'block' }} />
		</div>
	)
}
